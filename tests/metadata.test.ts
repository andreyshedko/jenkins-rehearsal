import { it, expect, vi } from "vitest";
import raw from "./fixtures/update-center.json";
import { FixtureProvider } from "../src/lib/jenkins/fixture-provider";
import {
  normalize,
  decodeUpdateCenter,
  UpdateCenterProvider,
} from "../src/lib/jenkins/update-center-provider";
import { ingest } from "../src/lib/jenkins/metadata-provider";
it("normalizes only scanner fields", async () => {
  const s = await new FixtureProvider().fetchSnapshot();
  expect(s.plugins.legacy.deprecated).toBe(true);
  expect(s.warnings[0].ranges[0].lastVersion).toBe("1.5");
  expect(s.plugins.git.dependencies[0].id).toBe("credentials");
});
it("rejects incomplete or incompatible upstream snapshots", () => {
  expect(() => normalize({}, "2.555.1", "fixture")).toThrow();
  expect(() => normalize(raw, "2.100", "fixture")).toThrow();
});
it("never executes JSONP", () => {
  expect(decodeUpdateCenter('updateCenter.post({"x":1});')).toEqual({ x: 1 });
  expect(() => decodeUpdateCenter("alert(1)")).toThrow();
});
it("does not activate failed ingestion", async () => {
  const activate = vi.fn();
  await expect(
    ingest(
      {
        fetchSnapshot: async () => {
          throw Error();
        },
      },
      { activate, active: vi.fn() },
    ),
  ).rejects.toThrow();
  expect(activate).not.toHaveBeenCalled();
});
it("fetches version-specific catalog using latest LTS (recorded fixture)", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("2.555.1"))
    .mockResolvedValueOnce(
      new Response(`updateCenter.post(${JSON.stringify(raw)});`),
    );
  vi.stubGlobal("fetch", fetcher);
  try {
    const s = await new UpdateCenterProvider().fetchSnapshot();
    expect(s.targetJenkinsVersion).toBe("2.555.1");
    expect(fetcher.mock.calls[1][0]).toContain("?version=2.555.1");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("preserves wildcard advisory bounds discovered in the live catalog", () => {
  const sample = structuredClone(raw);
  sample.warnings[0].versions[0].lastVersion = "1.*";
  const snapshot = normalize(sample, "2.555.1", "https://updates.jenkins.io/");
  expect(snapshot.warnings[0].ranges[0].lastVersion).toBe("1.*");
});
