/*
 * Glyph-coverage gate for the font subsets.
 *
 * The woff2 files are subset to the characters the site actually uses
 * (scripts/update-fonts.ts); the ranges they cover live in src/fonts.ts.
 * Adding copy with an uncovered glyph — say a "Zürich" in a translation —
 * is a silent regression: the glyph falls back to a system font, with no
 * build error. This test fails instead, telling you to run the subset regen.
 *
 * Pure string work, in the style of the linebreak tests: the ranges are
 * parsed out of src/fonts.ts, the content sources are scanned per character.
 * The theme-toggle glyphs (☾ ☀) are the one deliberate exception — they
 * render in the system symbol font, not in Noto Sans.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

/** Parse a CSS unicode-range list ("U+20-59, U+a0, …") into a set of codepoints. */
function parseUnicodeRange(range: string): Set<number> {
  const cps = new Set<number>();
  for (const part of range.split(",")) {
    const m = part.trim().match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
    if (!m) throw new Error(`Unparsable unicode-range entry: ${part}`);
    const from = parseInt(m[1]!, 16);
    const to = m[2] ? parseInt(m[2], 16) : from;
    for (let cp = from; cp <= to; cp++) cps.add(cp);
  }
  return cps;
}

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const fontsSource = readSource("./fonts.ts");

const covered = new Set<number>();
for (const match of fontsSource.matchAll(
  /const \w+_RANGE =\s*\n?\s*"([^"]+)"/g,
)) {
  for (const cp of parseUnicodeRange(match[1]!)) covered.add(cp);
}
if (covered.size === 0) throw new Error("No *_RANGE found in src/fonts.ts");

/** Rendered in the system symbol font on purpose (the theme toggle). */
const SYSTEM_FONT_GLYPHS = new Set(["☾", "☀"]);

const CONTENT_SOURCES = ["./translations.ts", "./render.ts"];

describe("font subset coverage", () => {
  test("every content glyph is covered by a subset's unicode-range", () => {
    const failures: string[] = [];
    for (const path of CONTENT_SOURCES) {
      const missing = new Set<string>();
      for (const ch of readSource(path)) {
        if (/\s/.test(ch) || SYSTEM_FONT_GLYPHS.has(ch)) continue;
        if (!covered.has(ch.codePointAt(0)!)) missing.add(ch);
      }
      if (missing.size > 0) {
        failures.push(
          `${path}: ${[...missing]
            .map(
              (c) =>
                `${c} (U+${c.codePointAt(0)!.toString(16).toUpperCase()})`,
            )
            .join(", ")}`,
        );
      }
    }
    // On failure the diff lists the uncovered glyphs: run `bun run fonts:update`.
    expect(failures).toEqual([]);
  });
});
