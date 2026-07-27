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
import { renderApp } from "../src/render.ts";
import { LANGS } from "../src/translations.ts";
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
    ["Noto Sans HK", sets.hk],
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

/*
 * The test above inherits `glyphSets`' blind spot: `isLatin`/`isCjk` decide
 * which characters are collected, and the assertion then checks the collected
 * ones — so a character both predicates reject is not "covered", it is
 * invisible, and no assertion can ever fail on it. That is how ☾ and ☀ sat
 * outside every subset while the guard stayed green.
 *
 * This second test shares nothing with the first but the parsed ranges. It
 * asks the renderer what the page can actually display and demands every
 * non-ASCII character in it be either inside a committed subset or on an
 * explicit, justified allowlist. New symbols in the copy now have to be
 * answered for instead of slipping between two predicates.
 */

/**
 * Characters deliberately left to the visitor's system font. ☾ ☀ are the theme
 * toggle: Noto Sans does not carry U+263E/U+2600 (measured — a Google Fonts
 * `&text=☾☀` request returns the same 1664-byte empty woff2 as a request for
 * an emoji it certainly lacks), so subsetting them in would ship a file without
 * the glyphs and make `unicode-range` claim codepoints the face does not have.
 * Adding an entry here is a decision, not a fix: it says "the system font may
 * render this". See the header of scripts/glyphs.ts.
 */
const FALLBACK_GLYPHS = new Set("☾☀");

const COVERED_BY_SOME_FACE = FONT_FACES.map((face) => coveredBy(face.range));

/**
 * The text a page actually shows: markup and its attributes stripped, entities
 * decoded back to the characters a browser would draw. Scanning rendered output
 * rather than source files is the point — the sources are read as raw text, so
 * an arrow in a code comment reads as page content when it is nothing of the
 * kind.
 */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, h: string) => String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Spread: `LANGS` is `readonly`, and `test.each` takes a mutable array.
test.each([...LANGS])(
  "every non-ASCII character the %s page renders is subset or allowlisted",
  (lang) => {
    // Both themes: the toggle renders ☾ in one and ☀ in the other, so a
    // single-theme scan would miss half the exception it exists to police.
    const text = visibleText(renderApp(lang, "light")) +
      visibleText(renderApp(lang, "dark"));

    const unaccounted = [...new Set(text)]
      .filter((ch) => {
        const cp = ch.codePointAt(0)!;
        if (cp <= 0x7e) return false;
        if (FALLBACK_GLYPHS.has(ch)) return false;
        return !COVERED_BY_SOME_FACE.some((covers) => covers(cp));
      })
      .map((ch) =>
        `${ch} (U+${ch.codePointAt(0)!.toString(16).toUpperCase()})`
      );

    // Failing here means new copy introduced a character no committed subset
    // carries. Fix by running `bun run fonts:update` (and widening the
    // predicates in glyphs.ts if it is a new script), or — if the system font
    // is genuinely the right answer — by adding it to FALLBACK_GLYPHS with a
    // reason.
    expect(unaccounted).toEqual([]);
  },
);
