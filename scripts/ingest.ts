import { ingest } from "../src/lib/jenkins/metadata-provider";
import { FixtureProvider } from "../src/lib/jenkins/fixture-provider";
import { UpdateCenterProvider } from "../src/lib/jenkins/update-center-provider";
import {
  LocalSnapshotStore,
  DatabaseSnapshotStore,
} from "../src/lib/server/snapshots";
import { hasDatabase } from "../src/lib/server/db";
try {
  const fixture = process.argv.includes("--fixture");
  if (fixture && process.env.NODE_ENV === "production")
    throw new Error("Fixtures disallowed in production");
  const result = await ingest(
    fixture ? new FixtureProvider() : new UpdateCenterProvider(),
    hasDatabase() ? new DatabaseSnapshotStore() : new LocalSnapshotStore(),
  );
  console.info(
    JSON.stringify({
      event: "metadata_ingested",
      snapshotId: result.id,
      target: result.targetJenkinsVersion,
      plugins: Object.keys(result.plugins).length,
      source: result.source,
    }),
  );
} catch {
  console.error(JSON.stringify({ event: "metadata_ingestion_failed" }));
  process.exitCode = 1;
}
