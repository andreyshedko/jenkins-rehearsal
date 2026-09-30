import { eventSchema } from "@/lib/server/schemas";
import {
  readBody,
  rateLimit,
  json,
  failure,
  HttpError,
  verifyToken,
} from "@/lib/server/http";
import { event } from "@/lib/server/persistence";
export async function POST(req: Request) {
  try {
    await rateLimit(req, "events", 60);
    const result = eventSchema.safeParse(await readBody(req, 2048));
    if (!result.success) throw new HttpError(400, "Invalid event.");
    verifyToken(result.data.scanId, result.data.token);
    await event(result.data.scanId, result.data.name);
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
