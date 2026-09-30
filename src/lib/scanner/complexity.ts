import type { Complexity, Finding } from "../jenkins/types";
export const complexityRules = {
  pluginCount: 50,
  manyChanges: 20,
  veryManyChanges: 50,
  highPoints: 5,
  veryHighPoints: 9,
};
export function classify(
  facts: {
    javaMigration: boolean | null;
    pluginCount: number;
    changes: number;
    findings: Finding[];
  },
  rules = complexityRules,
): { complexity: Complexity; drivers: string[] } {
  let points = 0;
  const drivers: string[] = [];
  const add = (condition: boolean, weight: number, label: string) => {
    if (condition) {
      points += weight;
      drivers.push(label);
    }
  };
  add(facts.javaMigration === true, 3, "Java migration required");
  add(
    facts.pluginCount >= rules.pluginCount,
    2,
    `${facts.pluginCount} installed plugins`,
  );
  add(
    facts.changes > 0,
    facts.changes >= rules.veryManyChanges
      ? 5
      : facts.changes >= rules.manyChanges
        ? 3
        : 1,
    `${facts.changes} proposed plugin changes`,
  );
  const unresolved = facts.findings.filter(
    (f) => f.code === "PLUGIN_MISSING" || f.code === "PLUGIN_UNKNOWN",
  ).length;
  const security = facts.findings.filter(
    (f) => f.code === "SECURITY_AFFECTED",
  ).length;
  const deprecated = facts.findings.filter(
    (f) => f.code === "DEPRECATED",
  ).length;
  const conflicts = facts.findings.filter(
    (f) => f.category === "dependency" && f.severity !== "INFO",
  ).length;
  add(unresolved > 0, 3, `${unresolved} unresolved plugins`);
  add(security > 0, 2, `${security} applicable security warnings`);
  add(deprecated > 0, 1, `${deprecated} deprecated plugins`);
  add(conflicts > 0, 3, `${conflicts} dependency issues`);
  return {
    complexity:
      points >= rules.veryHighPoints
        ? "VERY HIGH"
        : points >= rules.highPoints
          ? "HIGH"
          : points >= 2
            ? "MEDIUM"
            : "LOW",
    drivers: drivers.length
      ? drivers
      : ["No complexity drivers found in the available metadata"],
  };
}
export const qualificationRules = {
  complexities: ["HIGH", "VERY HIGH"] as Complexity[],
  pluginMinimum: 50,
  blockerMinimum: 1,
  controllerMinimum: 2,
};
export function qualifiedComplexScan(
  complexity: Complexity,
  plugins: number,
  blockers: number,
  controllers = 0,
  rules = qualificationRules,
) {
  return (
    rules.complexities.includes(complexity) ||
    (plugins >= rules.pluginMinimum && blockers >= rules.blockerMinimum) ||
    controllers >= rules.controllerMinimum
  );
}
