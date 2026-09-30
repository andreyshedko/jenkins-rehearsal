import type { MetadataSnapshot } from "./types";
export interface MetadataProvider {
  fetchSnapshot(): Promise<MetadataSnapshot>;
}
export interface SnapshotStore {
  activate(snapshot: MetadataSnapshot): Promise<void>;
  active(): Promise<MetadataSnapshot>;
}
export async function ingest(
  provider: MetadataProvider,
  store: SnapshotStore,
): Promise<MetadataSnapshot> {
  const snapshot = await provider.fetchSnapshot();
  if (!Object.keys(snapshot.plugins).length)
    throw new Error("Empty metadata snapshot");
  await store.activate(snapshot);
  return snapshot;
}
