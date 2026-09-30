import { createHmac, timingSafeEqual } from "node:crypto";
import { database, hasDatabase } from "./db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  console.error(JSON.stringify({ event: "request_failed" }));
  return json(
    {
      error: "The scanner is temporarily unavailable. Please try again later.",
    },
    503,
  );
}
export async function readBody(
  req: Request,
  limit = 150 * 1024,
): Promise<unknown> {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new HttpError(403, "Cross-origin request rejected.");
  if (
    req.headers.get("content-encoding") &&
    req.headers.get("content-encoding") !== "identity"
  )
    throw new HttpError(415, "Compressed requests are not supported.");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Expected JSON.");
  if (Number(req.headers.get("content-length")) > limit)
    throw new HttpError(413, "Request too large.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Empty request.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    ) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON or UTF-8 text.");
  }
}
function secret() {
  const key = process.env.EVENT_SIGNING_SECRET;
  if (key) return key;
  if (process.env.NODE_ENV === "production")
    throw Error("Signing secret missing");
  return "local-development-only-secret";
}
export function issueToken(
  scanId: string,
  expires = Date.now() + 24 * 60 * 60 * 1000,
) {
  const value = `${scanId}.${expires}`;
  return `${expires}.${createHmac("sha256", secret()).update(value).digest("hex")}`;
}
export function verifyToken(scanId: string, token: string) {
  const [expires, signature] = token.split(".");
  if (
    !expires ||
    !signature ||
    !/^\d+$/.test(expires) ||
    Number(expires) < Date.now()
  )
    throw new HttpError(403, "Report session expired. Run another scan.");
  const expected = issueToken(scanId, Number(expires)).split(".")[1];
  const a = Buffer.from(signature),
    b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new HttpError(403, "Invalid report session.");
}
const localLimits = new Map<string, { minute: number; count: number }>();
export async function rateLimit(req: Request, scope: string, max = 10) {
  // Vercel overwrites x-vercel-forwarded-for. Outside Vercel production, use a shared bucket
  // instead of trusting a client-spoofable forwarded header.
  const ip = process.env.VERCEL
    ? (req.headers.get("x-vercel-forwarded-for") ?? "shared")
    : "local";
  const key = createHmac("sha256", secret())
    .update(`${scope}:${ip}`)
    .digest("hex");
  if (hasDatabase()) {
    const { data, error } = await database().rpc("take_rate_limit", {
      bucket: key,
      max_hits: max,
    });
    if (error) throw Error("Rate limit unavailable");
    if (!data)
      throw new HttpError(
        429,
        "Too many requests. Wait one minute and try again.",
      );
  } else {
    if (process.env.NODE_ENV === "production")
      throw Error("Production database missing");
    const minute = Math.floor(Date.now() / 60000);
    const entry = localLimits.get(key);
    const count = entry?.minute === minute ? entry.count + 1 : 1;
    localLimits.set(key, { minute, count });
    if (count > max)
      throw new HttpError(
        429,
        "Too many requests. Wait one minute and try again.",
      );
  }
}
