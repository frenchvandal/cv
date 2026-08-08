/*
 * Glyph extraction shared by scripts/update-fonts.ts (which requests exactly
 * these characters from Google Fonts) and scripts/fonts-coverage.test.ts
 * (which asserts the committed unicode-ranges still cover them). One
 * implementation, so the generator and its guard can't drift—the same rule
 * as escapeHtml in [src/dom.ts](../src/dom.ts).
 */

import {
  type Lang,
  LANG_LABEL,
  LANG_NAME,
  LANGS,
  SWITCHER_LANGS,
  translations,
} from "../src/translations.ts";
import { loadPosts } from "./content.ts";

/** Files whose string literals can reach the page in the Latin-script languages. */
const LATIN_SOURCES = ["src/translations.ts", "src/render.ts"];

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
 * The language switcher renders every language's own label and name (简 / 繁,
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
 * every source file that contains user-visible literals—translations.ts AND
 * render.ts, since the markup carries text of its own (the `@handle` in
 * contact) that never passes through a translation object. The two Chinese
 * sets are extracted per language (from the imported translation objects, not
 * the raw file): Simplified and Traditional pages each ship only their own
 * script.
 *
 * Post titles and rendered text join the same sets, routed by the face each
 * page's font stack actually names for them (see --font in src/styles.css):
 * every stack opens with Noto Sans, so Latin runs in ANY language's posts
 * feed `latin`; CJK runs feed the one CJK family their page carries—SC for
 * zh AND for the Latin-script pages, whose base stack falls back to SC for a
 * 简体 aside, TC for zh-hant, HK for zh-hk. The Markdown source is never
 * scanned: its `#`/`*` syntax is not drawn, only the rendered text is.
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
  { latin: string; sc: string; tc: string; hk: string }
> {
  const root = `${import.meta.dir}/..`;
  const sources = (
    await Promise.all(
      LATIN_SOURCES.map((path) => Bun.file(`${root}/${path}`).text()),
    )
  ).join("");
  const posts = await loadPosts(`${root}/content`);
  const textOf = (langs: readonly Lang[]) =>
    posts
      .filter((post) => langs.includes(post.lang))
      .map((post) => post.title + post.text)
      .join("");
  const latinPosts = textOf(["en", "fr", "pt", "es"]);
  const zhPosts = textOf(["zh"]);
  return {
    // Every stack opens with Noto Sans, so a Latin run (an é, a « quote) in a
    // post of ANY language is drawn from this subset.
    latin: unique(sources + textOf(LANGS), (cp) => isLatin(cp)),
    // The Latin-script pages' stack names Noto Sans SC as its CJK fallback, so
    // a CJK run in an en/fr/pt/es post is drawn from the SC subset, not from a
    // system font—its characters must be requested here too.
    sc: unique(
      JSON.stringify(translations.zh) + switcher + zhPosts + latinPosts,
      isCjk,
    ),
    tc: unique(
      JSON.stringify(translations["zh-hant"]) + switcher + textOf(["zh-hant"]),
      isCjk,
    ),
    // Hong Kong shares Taiwan's script but not all its glyph FORMS (骨, 過, 溫
    // are drawn to a different standard), so it gets its own subset rather than
    // reusing the TC one—and its own vocabulary means its own character set.
    hk: unique(
      JSON.stringify(translations["zh-hk"]) + switcher + textOf(["zh-hk"]),
      isCjk,
    ),
  };
}
