import type { Comparison } from "./types";
// Conservative subset of hudson.util.VersionNumber: numeric components use BigInteger,
// trailing zeroes compare equal. Incremental hash suffixes are opaque. See docs/jenkins-metadata.md.
export const VERSION_SYNTAX = /^[0-9][A-Za-z0-9._+-]{0,127}$/;
export function compareVersions(a: string, b: string): Comparison {
  if (!VERSION_SYNTAX.test(a) || !VERSION_SYNTAX.test(b)) return "unknown";
  if (a === b) return 0;
  const parse = (v: string) => /^(\d+(?:\.\d+)*)(\.v[0-9a-f_]+)?$/.exec(v);
  const left = parse(a),
    right = parse(b);
  if (!left || !right) return "unknown";
  const x = left[1].split(".").map(BigInt),
    y = right[1].split(".").map(BigInt);
  // Different prefix lengths involving hashes require Jenkins' mixed-token ordering.
  if ((left[2] || right[2]) && x.length !== y.length) return "unknown";
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const l = x[i] ?? 0n,
      r = y[i] ?? 0n;
    if (l < r) return -1;
    if (l > r) return 1;
  }
  return left[2] || right[2] ? "unknown" : 0;
}
