import { timingSafeEqual } from "node:crypto";
import { ingest } from "@/lib/jenkins/metadata-provider";
import { UpdateCenterProvider } from "@/lib/jenkins/update-center-provider";
import { DatabaseSnapshotStore } from "@/lib/server/snapshots";
import { json, failure } from "@/lib/server/http";
export const maxDuration = 120;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return json({ error: "Unauthorized" }, 401);
  try {
    const result = await ingest(
      new UpdateCenterProvider(),
      new DatabaseSnapshotStore(),
    );
    return json({
      ok: true,
      snapshotId: result.id,
      target: result.targetJenkinsVersion,
    });
  } catch (error) {
    return failure(error);
  }
}
