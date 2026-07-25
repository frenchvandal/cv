/*
 * Coverage guard for the vendored font subsets: every character the pages can
 * display must fall inside the unicode-range of the face meant to render it.
 * This fails exactly when user-visible text gained a glyph the committed
 * .woff2 subsets don't carry — the browser would silently fall back to a
 * system font for it (and pretext would measure the wrong face) — i.e. when a
 * text change forgot `bun run fonts:update`. Pure string work: no canvas, no
 * network, safe for CI.
 */

import { expect, test } from "bun:test";
import { FONT_FACES } from "../src/fonts.ts";
import { glyphSets } from "./glyphs.ts";

/** Parse a CSS unicode-range value into a membership test. */
function coveredBy(range: string): (cp: number) => boolean {
  const intervals = range.split(",").map((part) => {
    const m = part.trim().match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
    if (!m) throw new Error(`Unparseable unicode-range part: "${part}"`);
    const lo = parseInt(m[1]!, 16);
    return [lo, m[2] ? parseInt(m[2], 16) : lo] as const;
  });
  return (cp) => intervals.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/** The characters of `text` the range does NOT cover, readably labelled. */
function uncovered(text: string, range: string): string[] {
  const covered = coveredBy(range);
  return [...new Set(text)]
    .filter((ch) => !covered(ch.codePointAt(0)!))
    .map((ch) => `${ch} (U+${ch.codePointAt(0)!.toString(16).toUpperCase()})`);
}

const RANGE = new Map(FONT_FACES.map((face) => [face.family, face.range]));
const sets = await glyphSets();

test.each(
  [
    ["Noto Sans", sets.latin],
    ["Noto Sans SC", sets.sc],
    ["Noto Sans TC", sets.tc],
  ] as const,
)(
  "%s subset covers every glyph its pages can render",
  (family, glyphs) => {
    const range = RANGE.get(family);
    expect(range).toBeDefined();
    // On failure the diff lists the exact missing characters; the fix is
    // always `bun run fonts:update`.
    expect(uncovered(glyphs, range!)).toEqual([]);
  },
);
