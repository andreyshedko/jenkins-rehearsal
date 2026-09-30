import { compareVersions } from "../jenkins/version";
import type { AffectedRange } from "../jenkins/types";
// Bounds are inclusive in Jenkins metadata. Java regex patterns are not executed in JS.
// Pattern-only ranges remain unknown, including arbitrary regexes or holes in ranges.
export function matchesRanges(
  version: string,
  ranges: AffectedRange[],
): boolean | null {
  if (!ranges.length) return null;
  let unknown = false;
  for (const range of ranges) {
    if (!range.firstVersion && !range.lastVersion) {
      unknown = true;
      continue;
    }
    const lower = range.firstVersion
      ? compareVersions(version, range.firstVersion)
      : 1;
    const upper = range.lastVersion
      ? compareVersions(version, range.lastVersion)
      : -1;
    if (lower === -1 || upper === 1) continue;
    if (lower === "unknown" || upper === "unknown") {
      unknown = true;
      continue;
    }
    // Only boundaries themselves, or a simple numeric interval whose regex is
    // independently verified as an exact finite set, establish affected status.
    if (version === range.firstVersion || version === range.lastVersion)
      return true;
    if (!range.pattern) return true;
    // Do not infer membership from min/max alone when upstream provides a regex.
    unknown = true;
  }
  return unknown ? null : false;
}
