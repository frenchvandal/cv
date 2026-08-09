import { expect, test } from "bun:test";
import { byLang, deriveSummary, langsOf, type PostMeta } from "./post.ts";

const post = (
  slug: string,
  lang: PostMeta["lang"],
  date: string,
): PostMeta => ({
  slug,
  lang,
  title: `${slug} (${lang})`,
  date,
  summary: "…",
  tags: [],
});

const CORPUS: PostMeta[] = [
  post("a", "fr", "2026-01-01"),
  post("a", "en", "2026-01-01"),
  post("b", "fr", "2026-03-01"),
  post("c", "zh", "2026-02-01"),
];

test("a language's index holds only its own posts, newest first", () => {
  expect(byLang(CORPUS, "fr").map((p) => p.slug)).toEqual(["b", "a"]);
  expect(byLang(CORPUS, "zh").map((p) => p.slug)).toEqual(["c"]);
  expect(byLang(CORPUS, "es")).toEqual([]);
});

test("langsOf gives the languages a post exists in, in site order", () => {
  expect(langsOf(CORPUS, "a")).toEqual(["en", "fr"]);
  expect(langsOf(CORPUS, "c")).toEqual(["zh"]);
  expect(langsOf(CORPUS, "unknown")).toEqual([]);
});

test("deriveSummary cuts at the end of a sentence when one is long enough", () => {
  // The sentence cut only kicks in once the text exceeds SUMMARY_MAX (a short
  // text is returned untouched, see below), and only if the sentence itself
  // is past a third of the budget — so the first sentence has to be long
  // enough to arm that branch.
  const text =
    "This first sentence is deliberately written to be long enough that " +
    "it clears well past a third of the summary budget. " +
    "word ".repeat(100);
  expect(deriveSummary(text)).toBe(
    "This first sentence is deliberately written to be long enough that " +
      "it clears well past a third of the summary budget.",
  );
});

test("deriveSummary truncates cleanly when there is no useful punctuation", () => {
  const text = "word ".repeat(100).trim();
  const summary = deriveSummary(text);

  expect(summary.length).toBeLessThanOrEqual(201);
  expect(summary.endsWith("word…")).toBe(true); // cuts on a whole word
});

test("deriveSummary returns a short text unchanged", () => {
  expect(deriveSummary("Short")).toBe("Short");
});

test("deriveSummary recognizes Chinese sentence-ending punctuation", () => {
  const firstSentence = "文".repeat(70) + "。";
  const text = firstSentence + "填".repeat(200);
  expect(deriveSummary(text)).toBe(firstSentence);
});

test("deriveSummary recognizes the Chinese question mark", () => {
  const firstSentence = "文".repeat(70) + "？";
  const text = firstSentence + "填".repeat(200);
  expect(deriveSummary(text)).toBe(firstSentence);
});

test("deriveSummary falls back to the raw budget for Chinese, which has no spaces", () => {
  // Chinese has no whitespace word boundaries, so there is no "mid-word" to
  // avoid — cutting at the character budget is the correct fallback here.
  const text = "文".repeat(300);
  expect(deriveSummary(text)).toBe("文".repeat(200) + "…");
});

/** True when `s` contains a UTF-16 surrogate with no matching partner — the
 * exact failure mode a code-point-unsafe truncation can produce. */
function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const unit = s.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      i++; // paired: skip the low surrogate we just matched
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true; // low surrogate with no preceding high surrogate
    }
  }
  return false;
}

test("deriveSummary never cuts a surrogate pair in half", () => {
  // Reproduces the bug as measured: 199 ASCII characters are exactly 199
  // UTF-16 units, so an astral character (outside the BMP — a two-unit
  // surrogate pair) placed right after them has its high surrogate sitting
  // at index 199, exactly the old SUMMARY_MAX cut point. A UTF-16-unit slice
  // split the pair and left a lone high surrogate behind — invalid UTF-16,
  // which a browser renders as U+FFFD.
  const withIdeograph = "x".repeat(199) + "𠮷" + "y".repeat(100);
  const withEmoji = "x".repeat(199) + "🎉" + "y".repeat(100);

  expect(hasLoneSurrogate(deriveSummary(withIdeograph))).toBe(false);
  expect(hasLoneSurrogate(deriveSummary(withEmoji))).toBe(false);
  expect(deriveSummary(withIdeograph)).toContain("𠮷");
  expect(deriveSummary(withEmoji)).toContain("🎉");
});

test("deriveSummary does not preserve emoji sequences split by the cut — documented, not fixed", () => {
  // A flag emoji is two regional-indicator code points, each its own
  // correctly paired surrogate pair. Code-point slicing keeps each one
  // intact on its own, but if the cut falls between the pair the flag
  // itself still splits — no lone surrogate (the hard guarantee), but not
  // the original glyph either. Grapheme-cluster integrity (flags, ZWJ
  // families) is out of scope for this function.
  const text = "x".repeat(199) + "🇫🇷" + "y".repeat(100);
  const summary = deriveSummary(text);

  expect(hasLoneSurrogate(summary)).toBe(false);
  expect(summary).not.toContain("🇫🇷");
});

test("byLang breaks same-date ties by slug, independent of input order", () => {
  const sameDay = (slug: string) => post(slug, "fr", "2026-01-01");
  const orderings = [
    [sameDay("b"), sameDay("a"), sameDay("c")],
    [sameDay("c"), sameDay("b"), sameDay("a")],
    [sameDay("a"), sameDay("c"), sameDay("b")],
  ];

  for (const corpus of orderings) {
    expect(byLang(corpus, "fr").map((p) => p.slug)).toEqual(["a", "b", "c"]);
  }
});
