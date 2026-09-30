import { leadSchema } from "@/lib/server/schemas";
import {
  readBody,
  rateLimit,
  json,
  failure,
  HttpError,
  verifyToken,
} from "@/lib/server/http";
import { database, hasDatabase } from "@/lib/server/db";
export async function POST(req: Request) {
  try {
    await rateLimit(req, "leads", 5);
    const result = leadSchema.safeParse(await readBody(req, 8192));
    if (!result.success)
      throw new HttpError(
        400,
        "Check your email, counts and paid-interest checkbox.",
      );
    const d = result.data;
    verifyToken(d.scanId, d.token);
    if (!hasDatabase())
      throw new HttpError(
        503,
        "Interest recording needs Supabase configuration. This local preview does not save contact details.",
      );
    const { error } = await database().rpc("record_interest", {
      payload: {
        scan_id: d.scanId,
        email: d.email,
        company: d.company ?? null,
        controller_count: d.controllerCount,
        job_count_range: d.jobCountRange,
        plugin_count_range: d.pluginCountRange,
        message: d.message ?? null,
        stated_paid_interest: d.statedPaidInterest,
      },
    });
    if (error) throw Error("Lead write failed");
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
