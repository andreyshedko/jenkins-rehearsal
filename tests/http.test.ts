import { it, expect } from "vitest";
import {
  readBody,
  issueToken,
  verifyToken,
  rateLimit,
} from "../src/lib/server/http";
import { leadSchema, scanSchema } from "../src/lib/server/schemas";
const request = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
it("rejects large, compressed, cross-origin and malformed requests", async () => {
  await expect(
    readBody(request("{}", { Origin: "https://evil.example" })),
  ).rejects.toThrow("Cross-origin");
  await expect(
    readBody(request("{}", { "Content-Encoding": "gzip" })),
  ).rejects.toThrow("Compressed");
  await expect(
    readBody(request("{}", { "Content-Type": "text/plain" })),
  ).rejects.toThrow("Expected JSON");
  await expect(readBody(request("not json"))).rejects.toThrow("Invalid JSON");
  await expect(readBody(request("123456"), 2)).rejects.toThrow("too large");
  await expect(
    readBody(request("{}", { "Content-Length": "99999" }), 2),
  ).rejects.toThrow("too large");
  expect(await readBody(request('{"ok":true}'))).toEqual({ ok: true });
});
it("signed report sessions cannot be altered or reused for another scan", () => {
  const token = issueToken("scan-a");
  expect(() => verifyToken("scan-a", token)).not.toThrow();
  expect(() => verifyToken("scan-b", token)).toThrow();
  expect(() => verifyToken("scan-a", issueToken("scan-a", 1))).toThrow();
  expect(() => verifyToken("scan-a", "oops")).toThrow();
});
it("requires explicit paid intent and rejects extra fields", () => {
  expect(leadSchema.safeParse({}).success).toBe(false);
  expect(
    scanSchema.safeParse({
      currentJenkinsVersion: "2.440.3",
      javaVersion: 11,
      inventory: "git:1",
      secret: "no",
    }).success,
  ).toBe(false);
});
it("local limit rejects excess requests", async () => {
  await rateLimit(request("{}"), "unit-test", 1);
  await expect(rateLimit(request("{}"), "unit-test", 1)).rejects.toThrow(
    "Too many",
  );
});
