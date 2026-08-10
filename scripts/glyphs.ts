/*
 * Glyph extraction shared by scripts/update-fonts.ts (which requests exactly
 * these characters from Google Fonts) and scripts/fonts-coverage.test.ts
 * (which asserts the committed unicode-ranges still cover them). One
 * implementation, so the generator and its guard can’t drift—the same rule
 * as escapeHtml in [src/dom.ts](../src/dom.ts).
 */

import {
  type Lang,
  LANG_LABEL,
  LANG_NAME,
  SWITCHER_LANGS,
  translations,
} from "../src/translations.ts";
import { loadPosts } from "./content.ts";

/*
 * Files whose string literals can reach the page in the Latin-script languages.
 *
 * The renderer used to be one file; splitting it (src/render/) moved every
 * user-visible literal out of the facade, so scanning `src/render.ts` alone
 * would now cover nothing. The whole folder is listed instead, and it is the
 * kind of list that rots silently: nothing fails when a file is missing from
 * it — a glyph simply falls back to a system font mid-line.
 */
const LATIN_SOURCES = [
  "src/translations.ts",
  "src/render.ts",
  "src/render/shell.ts",
  "src/render/cv.ts",
  "src/render/blog.ts",
];

/**
 * The family carrying the Chinese that a page written in another language
 * still renders. Named here because three places have to agree on the string:
 * the generator that fetches it, the coverage guard, and the `--font` stack in
 * [src/styles.css](../src/styles.css) — which cannot import, and is held to it
 * by [src/styles.test.ts](../src/styles.test.ts).
 */
export const INLINE_CJK_FAMILY = "Noto Sans CJK Inline";

function unique(
  text: string,
  pred: (cp: number, ch: string) => boolean,
): string {
  const set = new Set<string>();
  for (const ch of text) if (pred(ch.codePointAt(0)!, ch)) set.add(ch);
  return [...set].sort().join("");
}

const isLatin = (cp: number): boolean =>
  (cp >= 0x20 && cp <= 0x7e) ||
  (cp >= 0xa0 && cp <= 0x24f) ||
  (cp >= 0x2010 && cp <= 0x203a) ||
  cp === 0x20ac ||
  cp === 0xb0;
const isCjk = (cp: number, ch: string): boolean =>
  (cp >= 0x4e00 && cp <= 0x9fff) || // unified ideographs
  (cp >= 0x3000 && cp <= 0x303f) || // CJK punctuation（、。「」）
  (cp >= 0xff00 && cp <= 0xffef) || // fullwidth forms（？！：，）
  "—·".includes(ch);

/*
 * The language switcher renders every language’s own label and name (简 / 繁,
 * 简体中文 / 繁體中文), so both Chinese pages show Simplified AND Traditional
 * glyphs regardless of which one they are written in. These live outside the
 * per-language translation objects, so scanning those alone missed them and the
 * switcher fell back to a system font mid-line.
 */
const switcher = SWITCHER_LANGS.map((lang) =>
  LANG_LABEL[lang] + LANG_NAME[lang]
)
  .join("");

/**
 * The exact character set each face must carry. Latin glyphs are scanned from
 * every source file that contains user-visible literals—the translations AND
 * the renderer modules, since the markup carries text of its own (the
 * `@handle` in contact) that never passes through a translation object—plus
 * the articles’ rendered text. The two Chinese sets are extracted per language
 * (from the imported translation objects, not the raw file): Simplified and
 * Traditional pages each ship only their own script.
 *
 * The theme-toggle glyphs ☾ ☀ (U+263E, U+2600) are the one deliberate
 * exclusion, and `isLatin` stopping at U+024F is what enforces it: Noto Sans
 * does not carry them. Measured against the Google Fonts API on 2026-07-26—
 * a `&text=☾☀` request returns a 1664-byte woff2, byte-for-byte the size of
 * the same request for 🍕, i.e., an empty font. Subsetting them in would ship
 * a file without the glyphs AND make `unicode-range` claim codepoints the
 * face lacks, turning a known gap into a false guarantee. They render in the
 * system symbol font; replacing them with inline SVG (as `LOGOS` already
 * does) is the only real fix, not a wider scan.
 */
export async function glyphSets(): Promise<
  { latin: string; inline: string; sc: string; tc: string; hk: string }
> {
  const root = `${import.meta.dir}/..`;
  const sources = (
    await Promise.all(
      LATIN_SOURCES.map((path) => Bun.file(`${root}/${path}`).text()),
    )
  ).join("");

  /*
   * Articles too, from the rendered plain text rather than the Markdown
   * source: `#`, `*` and `|` are syntax, never drawn on the page, and a
   * character that is never drawn has no business enlarging a font subset.
   * Each language contributes to its own face — a Chinese article grows only
   * the Chinese subset a Chinese reader downloads.
   */
  const posts = await loadPosts();
  const textIn = (langs: readonly Lang[]) =>
    posts
      .filter((post) => langs.includes(post.lang))
      .map((post) => `${post.title}${post.summary}${post.text}`)
      .join("");

  /*
   * The Chinese a page NOT written in Chinese still renders: the switcher’s
   * own labels and endonyms (简 繁 简体中文 繁體中文, on every page in every
   * language), 微辣 in the English, French, Portuguese and Spanish CV, and
   * anything those languages’ articles quote. `markChinese` declares those
   * runs `lang="zh-Hans"`.
   *
   * This is its own family, and the reason is measured. It used to be folded
   * into the Simplified subset, which meant an English reader downloaded
   * 342 KB of Chinese font — sc-1 (154 KB) and sc-2 (188 KB), both of them —
   * to draw these twenty characters, six of which sit in a `.sr-only` span.
   * Measured in Chrome over `bun run preview`: 381 KB of font on the English
   * home page, against 39 KB of Latin. A family of its own is a few KB and
   * the CJK subsets stay where they belong, on the Chinese pages.
   */
  const latinPages = (["en", "fr", "pt", "es"] as const)
    .map((lang) => JSON.stringify(translations[lang]))
    .join("") + textIn(["en", "fr", "pt", "es"]);

  return {
    latin: unique(
      sources + textIn(["en", "fr", "pt", "es"]),
      (cp) => isLatin(cp),
    ),
    inline: unique(switcher + latinPages, isCjk),
    sc: unique(
      JSON.stringify(translations.zh) + switcher + textIn(["zh"]),
      isCjk,
    ),
    tc: unique(
      JSON.stringify(translations["zh-hant"]) + switcher + textIn(["zh-hant"]),
      isCjk,
    ),
    // Hong Kong shares Taiwan’s script but not all its glyph FORMS (骨, 過, 溫
    // are drawn to a different standard), so it gets its own subset rather than
    // reusing the TC one—and its own vocabulary means its own character set.
    hk: unique(
      JSON.stringify(translations["zh-hk"]) + switcher + textIn(["zh-hk"]),
      isCjk,
    ),
  };
}

/**
 * Whether a `unicode-range` covers a code point.
 *
 * Shared by the coverage test and the build, so the two cannot disagree about
 * what "covered" means — a second range parser is exactly the kind of near-copy
 * this repo has been bitten by before.
 */
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
export function uncovered(text: string, range: string): string[] {
  const covered = coveredBy(range);
  return [...new Set(text)]
    .filter((ch) => !covered(ch.codePointAt(0)!))
    .map((ch) => `${ch} (U+${ch.codePointAt(0)!.toString(16).toUpperCase()})`);
}

/**
 * A family’s ranges, joined. One family spans several files: the generator
 * asks Google in batches, because the endpoint stops text-subsetting above
 * roughly 800 glyphs. Keying by family without joining would silently keep one
 * batch and check a fraction of the coverage.
 */
export function rangesByFamily(
  faces: readonly { family: string; range: string }[],
): Map<string, string> {
  const ranges = new Map<string, string>();
  for (const face of faces) {
    const previous = ranges.get(face.family);
    ranges.set(
      face.family,
      previous ? `${previous},${face.range}` : face.range,
    );
  }
  return ranges;
}

/**
 * Every glyph the pages can render, against every subset that ships. Returns
 * only the families that fall short, so a caller can name them.
 *
 * The build runs this on every invocation because a missing glyph breaks
 * nothing it could otherwise notice: the character falls back to a system font
 * mid-line, and no exit code ever says so.
 */
export async function missingGlyphs(
  faces: readonly { family: string; range: string }[],
): Promise<{ family: string; missing: string[] }[]> {
  const ranges = rangesByFamily(faces);
  const sets = await glyphSets();

  return ([
    ["Noto Sans", sets.latin],
    [INLINE_CJK_FAMILY, sets.inline],
    ["Noto Sans SC", sets.sc],
    ["Noto Sans TC", sets.tc],
    ["Noto Sans HK", sets.hk],
  ] as const)
    .map(([family, glyphs]) => {
      const range = ranges.get(family);
      return {
        family,
        missing: range ? uncovered(glyphs, range) : ["(no subset at all)"],
      };
    })
    .filter((result) => result.missing.length > 0);
}
