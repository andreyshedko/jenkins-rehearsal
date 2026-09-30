import { randomUUID } from "node:crypto";
import { z } from "zod";
import { compareVersions, VERSION_SYNTAX } from "./version";
import type { MetadataSnapshot } from "./types";
import type { MetadataProvider } from "./metadata-provider";
const version = z.string().regex(VERSION_SYNTAX);
const safeUrl = z
  .string()
  .url()
  .refine((v) => new URL(v).protocol === "https:")
  .optional();
const upstream = z.object({
  generationTimestamp: z.string(),
  plugins: z.record(
    z.string(),
    z.object({
      name: z.string(),
      title: z.string(),
      version,
      requiredCore: version,
      dependencies: z.array(
        z.object({ name: z.string(), version, optional: z.boolean() }),
      ),
      health: z.number().optional(),
    }),
  ),
  deprecations: z.record(z.string(), z.object({ url: safeUrl })),
  warnings: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.enum(["core", "plugin"]),
      message: z.string(),
      url: safeUrl,
      versions: z.array(
        z.object({
          firstVersion: z.string().max(256).optional(),
          lastVersion: z.string().max(256).optional(),
          pattern: z.string().optional(),
        }),
      ),
    }),
  ),
});
export function decodeUpdateCenter(text: string): unknown {
  const trimmed = text.trim();
  // Strip only the known wrapper; never evaluate JSONP.
  const json =
    trimmed.startsWith("updateCenter.post(") && trimmed.endsWith(");")
      ? trimmed.slice("updateCenter.post(".length, -2)
      : trimmed;
  return JSON.parse(json) as unknown;
}
export function normalize(
  raw: unknown,
  target: string,
  sourceUrl: string,
  source: MetadataSnapshot["source"] = "jenkins",
): MetadataSnapshot {
  version.parse(target);
  const data = upstream.parse(raw);
  const timestamp = new Date(data.generationTimestamp);
  if (Number.isNaN(timestamp.getTime()))
    throw new Error("Invalid source timestamp");
  const plugins: MetadataSnapshot["plugins"] = Object.create(null);
  for (const [id, p] of Object.entries(data.plugins)) {
    const compatible = compareVersions(p.requiredCore, target);
    // The version-specific site is authoritative; reject an inconsistent response rather than silently dropping plugins.
    if (compatible === 1 || compatible === "unknown")
      throw new Error("Catalog contains unverifiable core requirements");
    plugins[id] = {
      id,
      name: p.title,
      version: p.version,
      requiredCore: p.requiredCore,
      dependencies: p.dependencies.map((d) => ({
        id: d.name,
        version: d.version,
        optional: d.optional,
      })),
      deprecated: Object.hasOwn(data.deprecations, id),
      deprecationUrl: data.deprecations[id]?.url,
      healthScore: p.health,
    };
  }
  return {
    id: randomUUID(),
    targetJenkinsVersion: target,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: timestamp.toISOString(),
    sourceUrl,
    source,
    plugins,
    warnings: data.warnings.map((w) => ({
      id: w.id,
      pluginId: w.type === "plugin" ? (w.name ?? null) : null,
      core: w.type === "core",
      message: w.message,
      url: w.url,
      ranges: w.versions,
    })),
  };
}
async function getText(url: string, limit: number): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body)
    throw new Error("Jenkins metadata unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Metadata size limit");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export class UpdateCenterProvider implements MetadataProvider {
  async fetchSnapshot(): Promise<MetadataSnapshot> {
    const target = (
      await getText("https://updates.jenkins.io/stable/latestCore.txt", 128)
    ).trim();
    if (!/^\d+\.\d+\.\d+$/.test(target)) throw new Error("Invalid latest LTS");
    const url = `https://updates.jenkins.io/update-center.json?version=${encodeURIComponent(target)}`;
    return normalize(
      decodeUpdateCenter(await getText(url, 16 * 1024 * 1024)),
      target,
      url,
    );
  }
}
