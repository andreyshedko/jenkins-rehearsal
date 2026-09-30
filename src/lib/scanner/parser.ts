import type { InstalledPlugin } from "../jenkins/types";
import { VERSION_SYNTAX } from "../jenkins/version";
export const MAX_INVENTORY_BYTES = 128 * 1024;
export const MAX_PLUGINS = 2000;
export interface ParseError {
  line: number;
  code: string;
  message: string;
}
export interface ParseResult {
  plugins: InstalledPlugin[];
  errors: ParseError[];
}
export interface InventoryParser {
  format: string;
  parse(text: string): ParseResult;
}
export const plainTextParser: InventoryParser = {
  format: "id:version",
  parse(text) {
    const errors: ParseError[] = [],
      plugins: InstalledPlugin[] = [];
    if (new TextEncoder().encode(text).length > MAX_INVENTORY_BYTES)
      return {
        plugins,
        errors: [
          {
            line: 0,
            code: "SIZE",
            message: "Inventory must be at most 128 KiB.",
          },
        ],
      };
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ufffd]/.test(text))
      return {
        plugins,
        errors: [
          {
            line: 0,
            code: "TEXT",
            message:
              "Use a plain UTF-8 text inventory, not a binary or compressed file.",
          },
        ],
      };
    const seen = new Map<string, number>();
    text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .forEach((raw, index) => {
        const line = raw.trim();
        if (!line || line.startsWith("#")) return;
        const match = /^([A-Za-z0-9][A-Za-z0-9_.-]{0,127}):([^:]+)$/.exec(line);
        if (!match || !VERSION_SYNTAX.test(match[2])) {
          errors.push({
            line: index + 1,
            code: "FORMAT",
            message: "Expected plugin-id:version (no spaces or extra fields).",
          });
          return;
        }
        const id = match[1];
        if (seen.has(id)) {
          errors.push({
            line: index + 1,
            code: "DUPLICATE",
            message: `Duplicate plugin; first listed on line ${seen.get(id)}.`,
          });
          return;
        }
        seen.set(id, index + 1);
        plugins.push({ id, version: match[2] });
      });
    if (plugins.length > MAX_PLUGINS)
      errors.push({
        line: 0,
        code: "COUNT",
        message: "Maximum 2,000 plugins per scan.",
      });
    if (!plugins.length && !errors.length)
      errors.push({
        line: 0,
        code: "EMPTY",
        message: "Enter at least one installed plugin.",
      });
    return { plugins, errors: errors.slice(0, 50) };
  },
};
export const parseInventory = (text: string): ParseResult =>
  plainTextParser.parse(text);
