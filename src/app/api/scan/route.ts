import { randomUUID } from "node:crypto";
import { scanSchema } from "@/lib/server/schemas";
import {
  readBody,
  rateLimit,
  json,
  failure,
  HttpError,
  issueToken,
} from "@/lib/server/http";
import { parseInventory } from "@/lib/scanner/parser";
import { analyzeUpgrade } from "@/lib/scanner/analyze";
import { activeMetadata } from "@/lib/server/active-metadata";
import { hasDatabase } from "@/lib/server/db";
import { event, persistReport } from "@/lib/server/persistence";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    await rateLimit(req, "scan");
    await event(null, "scan_started");
    const parsed = scanSchema.safeParse(await readBody(req));
    if (!parsed.success)
      throw new HttpError(
        400,
        "Check the Jenkins version, Java selection and inventory size.",
      );
    const inventory = parseInventory(parsed.data.inventory);
    if (inventory.errors.length)
      return json(
        { error: "Check your plugin inventory.", errors: inventory.errors },
        400,
      );
    const snapshot = await activeMetadata();
    const report = analyzeUpgrade(
      { ...parsed.data, plugins: inventory.plugins },
      snapshot,
    );
    const scanId = randomUUID();
    await persistReport(scanId, report);
    return json({
      report,
      scanId,
      token: issueToken(scanId),
      persistence: hasDatabase(),
    });
  } catch (error) {
    return failure(error);
  }
}
