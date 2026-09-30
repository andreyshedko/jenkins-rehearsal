import { beforeEach, describe, it, expect } from "vitest";
import { FixtureProvider } from "../src/lib/jenkins/fixture-provider";
import type { MetadataSnapshot, ScanInput } from "../src/lib/jenkins/types";
import { analyzeUpgrade } from "../src/lib/scanner/analyze";
import { matchesRanges } from "../src/lib/scanner/security";
import { classify, qualifiedComplexScan } from "../src/lib/scanner/complexity";
let snapshot: MetadataSnapshot;
beforeEach(async () => {
  snapshot = await new FixtureProvider().fetchSnapshot();
});
const input = (id = "git", version = "5.10.1"): ScanInput => ({
  currentJenkinsVersion: "2.555.1",
  javaVersion: 21,
  plugins: [{ id, version }],
});
const codes = (i: ScanInput) =>
  analyzeUpgrade(i, snapshot).findings.map((f) => f.code);
describe("upgrade analysis", () => {
  it("current core and Java have no Java blocker", () => {
    const r = analyzeUpgrade(input(), snapshot);
    expect(r.coreComparison).toBe(0);
    expect(r.java.target).toBe(true);
    expect(r.plugins.find((p) => p.id === "credentials")?.transitive).toBe(
      true,
    );
  });
  it("old core needs Java migration", () => {
    expect(
      codes({ ...input(), currentJenkinsVersion: "2.440.3", javaVersion: 11 }),
    ).toContain("JAVA_TARGET");
  });
  it("reports incorrect current Java", () => {
    expect(
      codes({ ...input(), currentJenkinsVersion: "2.60.1", javaVersion: 21 }),
    ).toContain("JAVA_CURRENT");
  });
  it("reports unknown Java and core", () => {
    expect(
      codes({
        ...input(),
        currentJenkinsVersion: "2.555-rc",
        javaVersion: null,
      }),
    ).toEqual(expect.arrayContaining(["JAVA_UNKNOWN", "CORE_UNKNOWN"]));
  });
  it("never suggests downgrade", () => {
    const r = analyzeUpgrade(
      { ...input("git", "9.0"), currentJenkinsVersion: "9.0" },
      snapshot,
    );
    expect(r.plugins[0].proposedVersion).toBe("9.0");
    expect(r.findings.map((f) => f.code)).toContain("CORE_NEWER");
  });
  it("identifies explicit deprecation", () =>
    expect(codes(input("legacy", "1.2"))).toContain("DEPRECATED"));
  it("matches affected version", () =>
    expect(codes(input("vulnerable", "1.5"))).toContain("SECURITY_AFFECTED"));
  it("does not flag historical advisory on fixed version", () =>
    expect(codes(input("vulnerable", "2.0"))).not.toContain(
      "SECURITY_AFFECTED",
    ));
  it("does not claim pattern range implies vulnerability", () =>
    expect(codes(input("vulnerable", "1.3"))).toContain("SECURITY_UNKNOWN"));
  it("missing catalog is unresolved, not incompatible", () => {
    const r = analyzeUpgrade(input("missing", "1"), snapshot);
    expect(r.findings[0].severity).toBe("WARNING");
    expect(r.findings[0].message).toContain("not proof");
  });
  it("finds dependency conflict and cycles", () => {
    expect(codes(input("conflict", "2"))).toContain("DEPENDENCY_CONFLICT");
    expect(codes(input("cycle-a", "1"))).toContain("DEPENDENCY_CYCLE");
  });
  it("finds unavailable dependencies", () => {
    delete snapshot.plugins.credentials;
    expect(codes(input())).toContain("DEPENDENCY_MISSING");
  });
  it("unknown version does not use catalog dependency graph", () => {
    const r = analyzeUpgrade(input("git", "5.0-custom"), snapshot);
    expect(r.plugins).toHaveLength(1);
    expect(r.plugins[0].status).toBe("unknown");
  });
  it("dependency comparison unknown is a warning", () => {
    snapshot.plugins.git.dependencies[0].version = "1-rc";
    expect(codes(input())).toContain("DEPENDENCY_UNKNOWN");
  });
  it("optional dependency is ignored unless installed", () => {
    snapshot.plugins.git.dependencies[0].optional = true;
    expect(analyzeUpgrade(input(), snapshot).plugins).toHaveLength(1);
    expect(
      analyzeUpgrade(
        {
          ...input(),
          plugins: [
            ...input().plugins,
            { id: "credentials", version: "1450.vdef" },
          ],
        },
        snapshot,
      ).plugins,
    ).toHaveLength(2);
  });
  it("catches inconsistent catalog core", () => {
    snapshot.plugins.git.requiredCore = "9.0";
    expect(codes(input())).toContain("REQUIRED_CORE");
    snapshot.plugins.git.requiredCore = "1-rc";
    expect(codes(input())).toContain("REQUIRED_CORE");
  });
  it("matches core security and ignores unrelated advisories", () => {
    snapshot.warnings.push(
      {
        id: "CORE",
        core: true,
        pluginId: null,
        message: "core",
        ranges: [{ lastVersion: "2.555.1" }],
      },
      {
        id: "OTHER",
        core: false,
        pluginId: "not-installed",
        message: "other",
        ranges: [],
      },
    );
    expect(codes(input())).toContain("SECURITY_AFFECTED");
  });
  it("is deterministic and does not mutate input", () => {
    const i = input();
    const before = JSON.stringify([i, snapshot]);
    expect(analyzeUpgrade(i, snapshot)).toEqual(analyzeUpgrade(i, snapshot));
    expect(JSON.stringify([i, snapshot])).toBe(before);
  });
});
describe("security bounds", () => {
  it.each([
    ["1.0", [{ firstVersion: "1.0", lastVersion: "1.5" }], true],
    ["1.3", [{ lastVersion: "1.5" }], true],
    ["0.9", [{ firstVersion: "1.0" }], false],
    ["2.0", [{ lastVersion: "1.5" }], false],
    ["1.1", [], null],
    ["1.1", [{ pattern: ".*" }], null],
    ["1-rc", [{ lastVersion: "1.5" }], null],
    ["2.0", [{ lastVersion: "1.0" }, { lastVersion: "2.0" }], true],
  ] as const)("matches %s", (v, r, e) =>
    expect(matchesRanges(v, [...r])).toBe(e),
  );
});
it("complexity and qualification are explainable and configurable", () => {
  expect(
    classify({ javaMigration: false, pluginCount: 1, changes: 0, findings: [] })
      .complexity,
  ).toBe("LOW");
  expect(
    classify({ javaMigration: true, pluginCount: 1, changes: 0, findings: [] })
      .complexity,
  ).toBe("MEDIUM");
  expect(
    classify({ javaMigration: true, pluginCount: 51, changes: 0, findings: [] })
      .complexity,
  ).toBe("HIGH");
  expect(
    classify({
      javaMigration: true,
      pluginCount: 51,
      changes: 50,
      findings: [],
    }).complexity,
  ).toBe("VERY HIGH");
  expect(
    classify({
      javaMigration: false,
      pluginCount: 1,
      changes: 20,
      findings: [],
    }).drivers,
  ).toContain("20 proposed plugin changes");
  expect(qualifiedComplexScan("HIGH", 1, 0)).toBe(true);
  expect(qualifiedComplexScan("LOW", 50, 1)).toBe(true);
  expect(qualifiedComplexScan("LOW", 1, 0, 2)).toBe(true);
  expect(qualifiedComplexScan("LOW", 1, 0)).toBe(false);
});
