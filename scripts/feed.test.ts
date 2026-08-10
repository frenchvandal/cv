/*
 * The feed's items are the articles now. These tests build Post objects by
 * hand—no disk, no git—because what matters is the mapping, not the corpus.
 */

import { expect, test } from "bun:test";
import type { Post } from "./content.ts";
import { translations } from "../src/translations.ts";
import {
  FEED_VERSION,
  feedFile,
  feedJson,
  type FeedOptions,
  jsonFeed,
} from "./feed.ts";

const post = (
  slug: string,
  lang: Post["lang"],
  date: string,
  extra: Partial<Post> = {},
): Post => ({
  slug,
  lang,
  title: `Titre ${slug}`,
  date,
  summary: `Résumé ${slug}`,
  tags: ["bun"],
  body: "Le corps.",
  html: `<p>Le corps de ${slug}.</p>`,
  text: "Le corps.",
  sourcePath: `content/posts/${slug}/${lang}.md`,
  ...extra,
});

const POSTS: Post[] = [
  post("a", "fr", "2026-01-01"),
  post("a", "en", "2026-01-01"),
  post("b", "fr", "2026-09-01", { updated: "2026-09-12" }),
];

const options = (over: Partial<FeedOptions> = {}): FeedOptions => ({
  lang: "fr",
  t: translations.fr,
  posts: POSTS,
  homePageUrl: "https://exemple.test/fr/",
  feedUrl: "https://exemple.test/feed.fr.json",
  postUrl: (p) => `https://exemple.test/${p.lang}/blog/${p.slug}.html`,
  ...over,
});

test("feedFile names the feeds, English unsuffixed", () => {
  expect(feedFile("en")).toBe("feed.json");
  expect(feedFile("fr")).toBe("feed.fr.json");
  expect(feedFile("zh-hant")).toBe("feed.zh-hant.json");
});

test("les items sont les articles de la langue, du plus récent au plus ancien", () => {
  const feed = jsonFeed(options());
  expect(feed.items.map((i) => i.title)).toEqual(["Titre b", "Titre a"]);
});

test("un item porte le HTML de l'article, pas seulement son texte", () => {
  const feed = jsonFeed(options());
  expect(feed.items[0]!.content_html).toBe("<p>Le corps de b.</p>");
});

test("date_published vient du frontmatter, pas de git", () => {
  const feed = jsonFeed(options());
  expect(feed.items[0]!.date_published).toBe("2026-09-01T00:00:00Z");
});

test("date_modified n'existe qu'avec un champ updated", () => {
  const feed = jsonFeed(options());
  expect(feed.items[0]!.date_modified).toBe("2026-09-12T00:00:00Z");
  expect(feed.items[1]!.date_modified).toBeUndefined();
});

test("l'id et l'url d'un item sont l'URL absolue de l'article", () => {
  const feed = jsonFeed(options());
  expect(feed.items[0]!.id).toBe("https://exemple.test/fr/blog/b.html");
  expect(feed.items[0]!.url).toBe("https://exemple.test/fr/blog/b.html");
});

test("aucune entrée du CV ne subsiste dans le feed", () => {
  const feed = jsonFeed(options());
  expect(JSON.stringify(feed)).not.toContain("Kapia");
});

test("le feed d'une langue sans article est valide et vide", () => {
  const feed = jsonFeed(options({ lang: "es", t: translations.es }));
  expect(feed.version).toBe(FEED_VERSION);
  expect(feed.items).toEqual([]);
});

test("jsonFeed rejects a relative URL", () => {
  expect(() => jsonFeed(options({ homePageUrl: "./fr/" }))).toThrow(
    "not absolute",
  );
});

test("feedJson is two-space JSON, newline-terminated", () => {
  const json = feedJson(jsonFeed(options()));
  expect(json.endsWith("\n")).toBe(true);
  expect(JSON.parse(json).version).toBe(FEED_VERSION);
});
