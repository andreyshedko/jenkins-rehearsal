import { database, hasDatabase } from "./db";
import type { UpgradeReport } from "../jenkins/types";
import { qualifiedComplexScan } from "../scanner/complexity";
export const eventNames = [
  "scan_started",
  "scan_completed",
  "report_viewed",
  "paid_rehearsal_cta_viewed",
  "paid_rehearsal_cta_clicked",
  "paid_rehearsal_interest_submitted",
] as const;
export async function event(
  scanId: string | null,
  name: (typeof eventNames)[number],
  data: Record<string, unknown> = {},
) {
  if (!hasDatabase()) {
    if (process.env.NODE_ENV === "production") throw Error("Database missing");
    return;
  }
  const { error } = await database()
    .from("events")
    .upsert(
      { scan_id: scanId, name, data_json: data },
      { onConflict: "scan_id,name", ignoreDuplicates: true },
    );
  if (error) throw Error("Event write failed");
}
export async function persistReport(id: string, r: UpgradeReport) {
  if (!hasDatabase()) {
    if (process.env.NODE_ENV === "production") throw Error("Database missing");
    return;
  }
  const blockers = r.findings.filter((f) => f.severity === "BLOCKER").length;
  const payload = {
    id,
    current_jenkins_version: r.currentJenkinsVersion,
    java_version: r.javaVersion,
    target_jenkins_version: r.targetJenkinsVersion,
    plugin_count: r.pluginCount,
    complexity: r.complexity,
    blocker_count: blockers,
    warning_count: r.findings.filter((f) => f.severity === "WARNING").length,
    security_warning_count: r.findings.filter(
      (f) => f.code === "SECURITY_AFFECTED",
    ).length,
    java_migration_required: r.java.migrationRequired,
    plugin_count_bucket:
      r.pluginCount < 20
        ? "1-19"
        : r.pluginCount < 50
          ? "20-49"
          : r.pluginCount < 100
            ? "50-99"
            : "100+",
    qualified_complex: qualifiedComplexScan(
      r.complexity,
      r.pluginCount,
      blockers,
    ),
    metadata_snapshot_id: r.snapshot.id,
  };
  // Never persist messages, plugin IDs, versions, inventory or the full report.
  const findings = r.findings.map((f) => ({
    category: f.category,
    severity: f.severity,
    code: f.code,
  }));
  const { error } = await database().rpc("persist_scan", { payload, findings });
  if (error) throw Error("Scan persistence failed");
}
