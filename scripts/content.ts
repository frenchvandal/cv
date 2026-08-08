/*
 * The corpus, read from `content/posts/<slug>/<lang>.md`.
 *
 * The file system IS the data: the folder name is the slug, the file name is
 * the language. There is therefore no mapping table to maintain, and the
 * rule "a post exists in 1..n languages" cannot be violated by omission.
 *
 * `zh-hk` is the exception, and it follows the CV: the Hong Kong page is a
 * lexical projection of the Taiwan one (see toHongKongText in
 * src/translations.ts), not a translation. A hand-written `zh-hk.md` takes
 * precedence over the projection.
 */

import { basename, dirname, join } from "node:path";
import { isLang, type Lang, toHongKongText } from "../src/translations.ts";
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

async function readPost(
  root: string,
  file: string,
  lang: Lang,
  slug: string,
): Promise<Post> {
  const sourcePath = join(root, "posts", slug, file);
  const source = await Bun.file(sourcePath).text();
  assertSafeMarkdown(source, sourcePath);
  const { data, body } = parseFrontmatter(source, sourcePath);
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
    html: await renderMarkdown(body, lang),
    text,
    sourcePath,
    // `draft` is absent: a built Post is publishable.
  };
}

/** The Hong Kong version of a Taiwan post, via the CV lexicon. */
async function projectHongKong(taiwan: Post): Promise<Post> {
  const body = toHongKongText(taiwan.body);
  return {
    ...taiwan,
    lang: "zh-hk",
    title: toHongKongText(taiwan.title),
    summary: toHongKongText(taiwan.summary),
    body,
    html: await renderMarkdown(body, "zh-hk"),
    text: toHongKongText(taiwan.text),
  };
}

export async function loadPosts(root = DEFAULT_ROOT): Promise<Post[]> {
  const glob = new Bun.Glob("*/*.md");
  const found: { file: string; lang: Lang; slug: string }[] = [];

  for await (const entry of glob.scan(join(root, "posts"))) {
    const file = basename(entry);
    const slug = dirname(entry);
    const lang = file.replace(/\.md$/, "");
    const sourcePath = join(root, "posts", entry);

    assertSlug(slug, sourcePath);
    if (!isLang(lang)) {
      throw new Error(
        `${sourcePath}: « ${lang} » n'est pas une langue du site`,
      );
    }
    found.push({ file, lang, slug });
  }

  const drafts = process.env.DRAFTS === "1";
  const all = await Promise.all(
    found.map(async ({ file, lang, slug }) => {
      const sourcePath = join(root, "posts", slug, file);
      const source = await Bun.file(sourcePath).text();
      const { data } = parseFrontmatter(source, sourcePath);
      return data.draft && !drafts
        ? null
        : await readPost(root, file, lang, slug);
    }),
  );

  const posts = all.filter((post): post is Post => post !== null);

  // HK projection: only for posts without an explicit zh-hk version.
  const explicit = new Set(
    posts.filter((p) => p.lang === "zh-hk").map((p) => p.slug),
  );
  const projected = await Promise.all(
    posts
      .filter((p) => p.lang === "zh-hant" && !explicit.has(p.slug))
      .map(projectHongKong),
  );

  return [...posts, ...projected];
}
