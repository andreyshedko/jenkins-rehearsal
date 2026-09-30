import policy from "./java-policy.json";
import { compareVersions } from "./version";
import type { JavaVersion } from "./types";
export function supportedJava(core: string): number[] | null {
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(core)) return null;
  const channel = core.split(".").length === 3 ? "lts" : "weekly";
  const row = policy.rows.find((r) => {
    const c = compareVersions(core, r[channel]);
    return c === 0 || c === 1;
  });
  return row?.supported ?? null;
}
export function javaSupport(core: string, java: JavaVersion): boolean | null {
  const supported = supportedJava(core);
  return java === null || !supported ? null : supported.includes(java);
}
