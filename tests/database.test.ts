import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { it, expect } from "vitest";
import { FixtureProvider } from "../src/lib/jenkins/fixture-provider";
it("migration, atomic activation, privacy projections, idempotent interest and rate limits", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role;",
    );
    const sql = await readFile(
      new URL("../supabase/migrations/001_scanner.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    const fixture = await new FixtureProvider().fetchSnapshot();
    const snapshot = { ...fixture, source: "jenkins" };
    await db.query("select activate_snapshot($1::jsonb)", [
      JSON.stringify(snapshot),
    ]);
    await expect(
      db.query("select activate_snapshot($1::jsonb)", [
        JSON.stringify({ ...snapshot, id: "invalid" }),
      ]),
    ).rejects.toThrow();
    expect(
      (await db.query("select id from metadata_snapshot where status='active'"))
        .rows,
    ).toEqual([{ id: snapshot.id }]);
    const id = "11111111-1111-4111-8111-111111111111";
    const payload = {
      id,
      current_jenkins_version: "2.440.3",
      java_version: 11,
      target_jenkins_version: "2.555.1",
      plugin_count: 70,
      complexity: "HIGH",
      blocker_count: 1,
      warning_count: 2,
      security_warning_count: 0,
      java_migration_required: true,
      plugin_count_bucket: "50-99",
      qualified_complex: true,
      metadata_snapshot_id: snapshot.id,
    };
    await db.query("select persist_scan($1::jsonb,$2::jsonb)", [
      JSON.stringify(payload),
      JSON.stringify([
        {
          category: "compatibility",
          severity: "WARNING",
          code: "PLUGIN_MISSING",
          pluginId: "sensitive-plugin",
          message: "sensitive version",
        },
      ]),
    ]);
    const findings = await db.query("select data_json from scan_findings");
    expect(findings.rows).toEqual([{ data_json: {} }]);
    const lead = {
      scan_id: id,
      email: "test@example.com",
      controller_count: 2,
      stated_paid_interest: true,
    };
    await db.query("select record_interest($1::jsonb)", [JSON.stringify(lead)]);
    await db.query("select record_interest($1::jsonb)", [JSON.stringify(lead)]);
    expect((await db.query("select count(*)::int n from leads")).rows).toEqual([
      { n: 1 },
    ]);
    expect(
      (
        await db.query(
          "select count(*)::int n from events where name='paid_rehearsal_interest_submitted'",
        )
      ).rows,
    ).toEqual([{ n: 1 }]);
    expect(
      (await db.query("select take_rate_limit('test',1) allowed")).rows,
    ).toEqual([{ allowed: true }]);
    expect(
      (await db.query("select take_rate_limit('test',1) allowed")).rows,
    ).toEqual([{ allowed: false }]);
    await db.exec("set role anon");
    await expect(db.query("select * from scans")).rejects.toThrow();
    await expect(db.query("select take_rate_limit('x',1)")).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 30000);
