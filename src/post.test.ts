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
