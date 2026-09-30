import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MetadataSnapshot } from "../jenkins/types";
import type { SnapshotStore } from "../jenkins/metadata-provider";
import { database } from "./db";
export class LocalSnapshotStore implements SnapshotStore {
  constructor(private directory = path.join(process.cwd(), ".data")) {}
  async activate(snapshot: MetadataSnapshot) {
    await mkdir(this.directory, { recursive: true });
    const temp = path.join(this.directory, `${snapshot.id}.tmp`);
    await writeFile(temp, JSON.stringify(snapshot));
    await rename(temp, path.join(this.directory, "active.json"));
  }
  async active() {
    return JSON.parse(
      await readFile(path.join(this.directory, "active.json"), "utf8"),
    ) as MetadataSnapshot;
  }
}
export class DatabaseSnapshotStore implements SnapshotStore {
  async activate(snapshot: MetadataSnapshot) {
    const { error } = await database().rpc("activate_snapshot", {
      payload: snapshot,
    });
    if (error) throw new Error("Snapshot activation failed");
  }
  async active() {
    const { data, error } = await database()
      .from("metadata_snapshot")
      .select("normalized_json")
      .eq("status", "active")
      .single();
    if (error || !data) throw new Error("No active metadata");
    return data.normalized_json as MetadataSnapshot;
  }
}
