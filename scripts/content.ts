/*
 * The corpus, read from `content/posts/<slug>/<lang>.md`.
 *
 * The file system IS the data: the folder name is the slug, the file name is
 * the language. There is therefore no mapping table to maintain, and the
 * rule "a post exists in 1..n languages" cannot be violated by omission.
 *
 * `zh-hk` is the exception, and it follows the CV: the Hong Kong post is a
 * lexical projection of the Taiwan one (see toHongKongText in
 * src/translations.ts), not a translation. A hand-written `zh-hk.md` takes
 * precedence over the projection.
 */

import { basename, dirname, join } from "node:path";
import {
  isLang,
  type Lang,
  LANGS,
  toHongKongText,
} from "../src/translations.ts";
import { deriveSummary, type PostMeta } from "../src/post.ts";
import { assertSlug } from "../src/urls.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { assertSafeMarkdown, renderMarkdown } from "./markdown.ts";

export interface Post extends PostMeta {
  body: string;
  html: string;
  text: string;
  sourcePath: string;
}

const DEFAULT_ROOT = "content";

/**
 * Reads and validates one file, returning `null` when it is a draft the
 * caller does not want. A single pass — read once, parse once — rather than
 * a first pass to filter drafts and a second to build the Post: the corpus
 * is read once per build, not in a hot loop, so there is nothing to gain
 * from splitting it, and one pass means a draft's Markdown is validated the
 * same as a published post's, catching an unsafe draft before publication
 * rather than the day it goes live.
 */
async function readPost(
  sourcePath: string,
  lang: Lang,
  slug: string,
  drafts: boolean,
): Promise<Post | null> {
  const source = await Bun.file(sourcePath).text();
  assertSafeMarkdown(source, sourcePath);
  const { data, body } = parseFrontmatter(source, sourcePath);
  if (data.draft && !drafts) return null;

  const text = Bun.markdown.render(body);

  return {
    slug,
    lang,
    title: data.title,
    date: data.date,
    ...(data.updated ? { updated: data.updated } : {}),
    summary: data.summary ?? deriveSummary(text),
    tags: data.tags,
    body,
    html: await renderMarkdown(body, lang, sourcePath),
    text,
    sourcePath,
    // `draft` is absent: a Post that made it out of this function is
    // publishable, whether or not DRAFTS=1 let it through.
  };
}

/** The Hong Kong version of a Taiwan post, via the CV's shared lexicon. */
async function projectHongKong(taiwan: Post): Promise<Post> {
  const body = toHongKongText(taiwan.body);
  return {
    ...taiwan,
    lang: "zh-hk",
    title: toHongKongText(taiwan.title),
    summary: toHongKongText(taiwan.summary),
    body,
    html: await renderMarkdown(body, "zh-hk", taiwan.sourcePath),
    text: toHongKongText(taiwan.text),
  };
}

/**
 * Total order on posts: slug first, then the site's canonical language
 * order. `Bun.Glob().scan()` was measured (see task-5-report.md) to hand
 * back entries in an order that is neither insertion order nor
 * lexicographic — stable within a process, but not something a build may
 * depend on staying the same across machines. Sorting once here, after
 * discovery and HK projection, means every caller of `loadPosts` gets a
 * reproducible order for free instead of having to sort itself.
 */
function comparePosts(a: Post, b: Post): number {
  if (a.slug !== b.slug) return a.slug < b.slug ? -1 : 1;
  return LANGS.indexOf(a.lang) - LANGS.indexOf(b.lang);
}

export async function loadPosts(root = DEFAULT_ROOT): Promise<Post[]> {
  const glob = new Bun.Glob("*/*.md");
  const drafts = process.env.DRAFTS === "1";

  const found: { sourcePath: string; lang: Lang; slug: string }[] = [];
  for await (const entry of glob.scan(join(root, "posts"))) {
    const slug = dirname(entry);
    const lang = basename(entry, ".md");
    const sourcePath = join(root, "posts", entry);

    assertSlug(slug, sourcePath);
    if (!isLang(lang)) {
      throw new Error(
        `${sourcePath}: « ${lang} » n'est pas une langue du site`,
      );
    }
    found.push({ sourcePath, lang, slug });
  }

  const read = await Promise.all(
    found.map(({ sourcePath, lang, slug }) =>
      readPost(sourcePath, lang, slug, drafts)
    ),
  );
  const posts = read.filter((post): post is Post => post !== null);

  // HK projection: only for posts without an explicit zh-hk version.
  const explicit = new Set(
    posts.filter((p) => p.lang === "zh-hk").map((p) => p.slug),
  );
  const projected = await Promise.all(
    posts
      .filter((p) => p.lang === "zh-hant" && !explicit.has(p.slug))
      .map(projectHongKong),
  );

  return [...posts, ...projected].sort(comparePosts);
}
