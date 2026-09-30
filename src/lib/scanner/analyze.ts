import type {
  ScanInput,
  MetadataSnapshot,
  UpgradeReport,
  Finding,
  PluginResult,
  CatalogPlugin,
} from "../jenkins/types";
import { compareVersions } from "../jenkins/version";
import { javaSupport, supportedJava } from "../jenkins/java-support";
import { matchesRanges } from "./security";
import { classify } from "./complexity";
export function analyzeUpgrade(
  input: ScanInput,
  snapshot: MetadataSnapshot,
): UpgradeReport {
  const findings: Finding[] = [];
  const add = (finding: Finding) => findings.push(finding);
  const target = snapshot.targetJenkinsVersion;
  const currentJava = javaSupport(
      input.currentJenkinsVersion,
      input.javaVersion,
    ),
    targetJava = javaSupport(target, input.javaVersion);
  const migration = targetJava === null ? null : !targetJava;
  if (currentJava === false)
    add({
      category: "java",
      severity: "BLOCKER",
      code: "JAVA_CURRENT",
      message:
        "The selected Java version is not supported by your current Jenkins. Verify the runtime version.",
    });
  if (targetJava === false)
    add({
      category: "java",
      severity: "BLOCKER",
      code: "JAVA_TARGET",
      message: `Target Jenkins supports Java ${supportedJava(target)?.join(" or ")}. Test a supported runtime before upgrading.`,
    });
  if (targetJava === null || currentJava === null)
    add({
      category: "java",
      severity: "WARNING",
      code: "JAVA_UNKNOWN",
      message:
        "Java compatibility could not be fully determined. Verify controller and agent runtimes.",
    });
  const coreComparison = compareVersions(input.currentJenkinsVersion, target);
  if (coreComparison === 1)
    add({
      category: "core",
      severity: "WARNING",
      code: "CORE_NEWER",
      message:
        "Current Jenkins is newer than this LTS target. This report is not a downgrade plan.",
    });
  if (coreComparison === "unknown")
    add({
      category: "core",
      severity: "WARNING",
      code: "CORE_UNKNOWN",
      message: "Core version ordering is unknown.",
    });
  const installed = new Map(input.plugins.map((p) => [p.id, p.version]));
  const results = new Map<string, PluginResult>();
  const graph = new Map<string, string[]>();
  const catalog = (id: string): CatalogPlugin | undefined =>
    Object.hasOwn(snapshot.plugins, id) ? snapshot.plugins[id] : undefined;
  const queue = input.plugins.map((p) => p.id);
  // Propose catalog releases only when they are demonstrably equal or newer.
  // Never downgrade a newer/unknown installed release or use its unknown dependency list.
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (results.has(id)) continue;
    const p = catalog(id),
      version = installed.get(id) ?? null,
      transitive = !installed.has(id);
    const comparison =
      p && version ? compareVersions(version, p.version) : "unknown";
    const status: PluginResult["status"] = !p
      ? "missing"
      : !version
        ? "add"
        : comparison === -1
          ? "update-offered"
          : comparison === 0
            ? "current"
            : comparison === 1
              ? "newer-installed"
              : "unknown";
    const usable =
      p &&
      (status === "add" || status === "current" || status === "update-offered");
    results.set(id, {
      id,
      installedVersion: version,
      offeredVersion: p?.version ?? null,
      proposedVersion: usable ? p.version : version,
      comparison,
      status,
      requiredCore: p?.requiredCore ?? null,
      dependencies: usable ? p.dependencies : [],
      transitive,
    });
    if (!p) {
      add({
        category: "compatibility",
        severity: "WARNING",
        code: "PLUGIN_MISSING",
        pluginId: id,
        message:
          "No compatible release found in the selected Jenkins Update Center metadata. This is not proof of incompatibility.",
      });
      continue;
    }
    if (!usable) {
      add({
        category: "compatibility",
        severity: "WARNING",
        code: "PLUGIN_UNKNOWN",
        pluginId: id,
        message:
          "Installed release is newer than, or cannot be ordered against, the offered release. Its core requirements and dependencies are unverified.",
      });
      continue;
    }
    const core = compareVersions(p.requiredCore, target);
    if (core === 1 || core === "unknown")
      add({
        category: "compatibility",
        severity: core === 1 ? "BLOCKER" : "WARNING",
        code: "REQUIRED_CORE",
        pluginId: id,
        message: `Offered release requires Jenkins ${p.requiredCore}; verify the metadata snapshot.`,
      });
    const dependencies = p.dependencies.filter(
      (d) => !d.optional || installed.has(d.id),
    );
    graph.set(
      id,
      dependencies.map((d) => d.id),
    );
    for (const d of dependencies) {
      if (!results.has(d.id)) queue.push(d.id);
    }
  }
  for (const [id, r] of results) {
    for (const dep of r.dependencies) {
      if (dep.optional && !installed.has(dep.id)) continue;
      const proposed = results.get(dep.id);
      if (!installed.has(dep.id))
        add({
          category: "dependency",
          severity: proposed?.status === "missing" ? "BLOCKER" : "INFO",
          code: "DEPENDENCY_MISSING",
          pluginId: id,
          message: `Required dependency ${dep.id} is not installed.${proposed?.status === "missing" ? " No target release is available." : " Proposed as a transitive addition."}`,
        });
      if (!proposed?.proposedVersion) continue;
      const check = compareVersions(proposed.proposedVersion, dep.version);
      if (check === -1 || check === "unknown")
        add({
          category: "dependency",
          severity: check === -1 ? "BLOCKER" : "WARNING",
          code: check === -1 ? "DEPENDENCY_CONFLICT" : "DEPENDENCY_UNKNOWN",
          pluginId: id,
          message: `Dependency ${dep.id} requires at least ${dep.version}; proposed ${proposed.proposedVersion}${check === "unknown" ? " (ordering unknown)" : ""}.`,
        });
    }
  }
  // Iterative DFS avoids recursion exhaustion on long plugin chains.
  const colors = new Map<string, number>();
  for (const root of graph.keys()) {
    if (colors.has(root)) continue;
    const stack: { id: string; exit: boolean }[] = [{ id: root, exit: false }];
    while (stack.length) {
      const item = stack.pop()!;
      if (item.exit) {
        colors.set(item.id, 2);
        continue;
      }
      if (colors.get(item.id) === 2) continue;
      if (colors.get(item.id) === 1) {
        add({
          category: "dependency",
          severity: "WARNING",
          code: "DEPENDENCY_CYCLE",
          pluginId: item.id,
          message:
            "Dependency cycle found in the proposed plugin graph. Review before applying changes.",
        });
        continue;
      }
      colors.set(item.id, 1);
      stack.push({ id: item.id, exit: true });
      for (const next of graph.get(item.id) ?? [])
        stack.push({ id: next, exit: false });
    }
  }
  for (const p of input.plugins) {
    const entry = catalog(p.id);
    if (entry?.deprecated)
      add({
        category: "maintenance",
        severity: "WARNING",
        code: "DEPRECATED",
        pluginId: p.id,
        message: `Installed ${p.version}: Jenkins explicitly marks this plugin deprecated.`,
        reference: entry.deprecationUrl,
      });
  }
  for (const w of snapshot.warnings) {
    const version = w.core
      ? input.currentJenkinsVersion
      : w.pluginId
        ? installed.get(w.pluginId)
        : undefined;
    if (!version) continue;
    const affected = matchesRanges(version, w.ranges);
    if (affected !== false)
      add({
        category: "security",
        severity: "WARNING",
        code: affected ? "SECURITY_AFFECTED" : "SECURITY_UNKNOWN",
        pluginId: w.pluginId ?? undefined,
        message: `${w.id}: ${affected ? w.message : "Advisory applicability is unknown; review the affected versions manually."}`,
        reference: w.url,
      });
  }
  const plugins = [...results.values()];
  const changes = plugins.filter(
    (p) => p.status === "update-offered" || p.status === "add",
  ).length;
  const complexity = classify({
    javaMigration: migration,
    pluginCount: input.plugins.length,
    changes,
    findings,
  });
  const recommendations = [
    "Read the Jenkins LTS upgrade guides and verify a restorable backup before making changes.",
  ];
  if (migration)
    recommendations.push(
      "Test the required Java migration on controllers and agents before the target upgrade.",
    );
  if (findings.some((f) => f.code === "DEPRECATED"))
    recommendations.push(
      "Investigate migration or replacement for deprecated plugins.",
    );
  if (
    findings.some((f) =>
      [
        "PLUGIN_MISSING",
        "PLUGIN_UNKNOWN",
        "DEPENDENCY_CONFLICT",
        "DEPENDENCY_UNKNOWN",
        "DEPENDENCY_CYCLE",
      ].includes(f.code),
    )
  )
    recommendations.push(
      "Verify unresolved plugins and dependencies manually or in an isolated controller rehearsal.",
    );
  if (findings.some((f) => f.category === "security"))
    recommendations.push(
      "Review the linked advisories and confirm remediated versions.",
    );
  if (changes)
    recommendations.push(
      "Apply and test the proposed plugin changes in a staging copy first.",
    );
  return {
    currentJenkinsVersion: input.currentJenkinsVersion,
    javaVersion: input.javaVersion,
    targetJenkinsVersion: target,
    coreComparison,
    pluginCount: input.plugins.length,
    snapshot: {
      id: snapshot.id,
      generatedAt: snapshot.generatedAt,
      sourceGeneratedAt: snapshot.sourceGeneratedAt,
      source: snapshot.source,
      sourceUrl: snapshot.sourceUrl,
    },
    java: {
      current: currentJava,
      target: targetJava,
      supportedTarget: supportedJava(target),
      migrationRequired: migration,
    },
    plugins,
    findings,
    ...complexity,
    recommendations,
  };
}
