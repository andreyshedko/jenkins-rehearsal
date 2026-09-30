import { describe, it, expect } from "vitest";
import cases from "./fixtures/versions.json";
import { compareVersions } from "../src/lib/jenkins/version";
import { javaSupport, supportedJava } from "../src/lib/jenkins/java-support";
import { parseInventory, MAX_INVENTORY_BYTES } from "../src/lib/scanner/parser";
describe("Jenkins version subset", () => {
  it.each(cases)("%s vs %s", (a, b, result) =>
    expect(compareVersions(String(a), String(b))).toBe(result),
  );
  it("is symmetric", () => {
    expect(compareVersions("2.10", "2.9")).toBe(1);
  });
});
describe("Java policy", () => {
  it.each([
    ["2.440.3", 11, true],
    ["2.555.1", 17, false],
    ["2.555.1", 21, true],
    ["2.555.1", 25, true],
    ["2.541.1", 17, true],
    ["2.479.1", 11, false],
    ["2.462.3", 11, true],
    ["2.463", 11, false],
    ["2.346.1", 8, true],
    ["2.361.1", 8, false],
    ["2.60.1", 11, false],
  ] as const)("%s Java %s", (v, j, result) =>
    expect(javaSupport(v, j)).toBe(result),
  );
  it("does not invent unknown support", () => {
    expect(javaSupport("2.555.1", null)).toBeNull();
    expect(supportedJava("2.555-rc")).toBeNull();
    expect(supportedJava("1.1")).toBeNull();
  });
});
describe("inventory parser", () => {
  it("accepts comments, BOM, blank lines and opaque versions", () => {
    expect(
      parseInventory(
        "\uFEFF# comment\r\ngit:5.2.1\r\n\ncredentials:1337.v60b_d7b_c7b_c9f",
      ).plugins,
    ).toHaveLength(2);
  });
  it("reports duplicates with line numbers", () => {
    expect(parseInventory("git:1\ngit:2").errors[0]).toMatchObject({
      line: 2,
      code: "DUPLICATE",
    });
  });
  it.each([
    "git",
    "git:1:2",
    "git:",
    "git:hello world",
    ":1",
    "git:1\u0000",
    "PK\u0003\u0004",
    "\ufffd",
    "",
  ])("rejects malformed %s", (text) =>
    expect(parseInventory(text).errors.length).toBeGreaterThan(0),
  );
  it("bounds bytes and count", () => {
    expect(
      parseInventory("x".repeat(MAX_INVENTORY_BYTES + 1)).errors[0].code,
    ).toBe("SIZE");
    expect(
      parseInventory(
        Array.from({ length: 2001 }, (_, i) => `p${i}:1`).join("\n"),
      ).errors[0].code,
    ).toBe("COUNT");
  });
});
