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

test("l'index d'une langue ne contient que ses articles, du plus récent au plus ancien", () => {
  expect(byLang(CORPUS, "fr").map((p) => p.slug)).toEqual(["b", "a"]);
  expect(byLang(CORPUS, "zh").map((p) => p.slug)).toEqual(["c"]);
  expect(byLang(CORPUS, "es")).toEqual([]);
});

test("langsOf donne les langues où l'article existe, dans l'ordre du site", () => {
  expect(langsOf(CORPUS, "a")).toEqual(["en", "fr"]);
  expect(langsOf(CORPUS, "c")).toEqual(["zh"]);
  expect(langsOf(CORPUS, "inconnu")).toEqual([]);
});

test("deriveSummary coupe à la fin d'une phrase quand il y en a une", () => {
  // The sentence cut only kicks in past SUMMARY_MAX (a short text is
  // returned as-is, see the next test), and only if the sentence exceeds a
  // third of the budget — so the first sentence must be long enough to arm
  // that branch.
  const text =
    "Première phrase, assez longue pour dépasser le tiers du budget de résumé. " +
    "mot ".repeat(100);
  expect(deriveSummary(text)).toBe(
    "Première phrase, assez longue pour dépasser le tiers du budget de résumé.",
  );
});

test("deriveSummary tronque proprement un texte sans ponctuation utile", () => {
  const text = "mot ".repeat(100).trim();
  const summary = deriveSummary(text);

  expect(summary.length).toBeLessThanOrEqual(201);
  expect(summary.endsWith("…")).toBe(true);
  expect(summary.endsWith("mot…")).toBe(true); // cuts on a whole word
});

test("deriveSummary rend un texte court tel quel", () => {
  expect(deriveSummary("Court")).toBe("Court");
});
