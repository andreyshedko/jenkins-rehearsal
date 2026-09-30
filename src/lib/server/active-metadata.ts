import type { MetadataSnapshot } from "../jenkins/types";
import { DatabaseSnapshotStore, LocalSnapshotStore } from "./snapshots";
import { hasDatabase } from "./db";
import { HttpError } from "./http";
let cached: { snapshot: MetadataSnapshot; until: number } | undefined;
export async function activeMetadata() {
  const now = Date.now();
  // Short in-process cache avoids repeated large database reads. Source snapshots
  // are persisted; this cache is only an optimization and is never authoritative.
  const snapshot =
    cached && cached.until > now
      ? cached.snapshot
      : await (
          hasDatabase() ? new DatabaseSnapshotStore() : new LocalSnapshotStore()
        ).active();
  if (process.env.NODE_ENV === "production" && snapshot.source !== "jenkins")
    throw Error("Fixture snapshot in production");
  const timestamps = [
    snapshot.generatedAt,
    ...(snapshot.source === "jenkins" && snapshot.sourceGeneratedAt
      ? [snapshot.sourceGeneratedAt]
      : []),
  ];
  if (
    timestamps.some(
      (t) =>
        !Number.isFinite(Date.parse(t)) || now - Date.parse(t) > 7 * 86400000,
    )
  )
    throw new HttpError(
      503,
      "Metadata is more than seven days old. Please try again after it is refreshed.",
    );
  cached = { snapshot, until: now + 60000 };
  return snapshot;
}
