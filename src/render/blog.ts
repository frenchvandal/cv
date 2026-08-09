/*
 * The blog page bodies: home's "latest writing", the full index, and one
 * article. Pure string rendering like the rest of src/render—no DOM, no
 * disk—so the static build and the client share the same code. Page assembly
 * (nav + body inside the shared shell) is `renderPage` in
 * [src/render.ts](src/render.ts); this module only produces the `<main>`
 * content and the language-switcher targets a blog page needs.
 *
 * `html` on a `post` page arrives ALREADY SAFE—the Markdown pipeline produced
 * and validated it—and is inserted verbatim. Everything else that is
 * data—titles, summaries, dates, tags—goes through escapeHtml.
 */

import { escapeHtml } from "../dom.ts";
import { byLang, HOME_POST_COUNT, langsOf, type PostMeta } from "../post.ts";
import { HTML_LANG, type Lang, type Translation } from "../translations.ts";
import { hrefTo, type PageRef } from "../urls.ts";
import { hero } from "./cv.ts";
import type { LangLink } from "./shell.ts";
import { section } from "./shell.ts";

export type Page =
  | { kind: "home"; posts: readonly PostMeta[] }
  | { kind: "cv" }
  | { kind: "blogIndex"; posts: readonly PostMeta[] }
  | {
    kind: "post";
    post: PostMeta;
    html: string;
    posts: readonly PostMeta[];
  };

/** Where a page lives, from the two facts a `Page` carries plus the language. */
// Exported for the facade, which needs it to place the nav links.
export function pageRefOf(page: Page, lang: Lang): PageRef {
  switch (page.kind) {
    case "home":
      return { kind: "home", lang };
    case "cv":
      return { kind: "cv", lang };
    case "blogIndex":
      return { kind: "blogIndex", lang };
    case "post":
      return { kind: "post", lang, slug: page.post.slug };
  }
}

/*
 * The readable date, in the page's language. HTML_LANG already carries the
 * site's BCP-47 tags (pt-PT, es-ES, zh-Hant-HK…): reuse it rather than open a
 * second table that would drift. `timeZone: "UTC"` is required—without it a
 * bare date is read in the build machine's own zone and slips a day west of
 * Greenwich.
 */
function formatDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(HTML_LANG[lang], {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * A run of posts as links, newest first (the order the caller already sorted
 * them in). `role="list"` restores the semantics `list-style: none` strips in
 * Safari/VoiceOver—same rule as the CV timeline.
 */
function postList(from: PageRef, posts: readonly PostMeta[]): string {
  const items = posts.map((post) => {
    const href = hrefTo(from, {
      kind: "post",
      lang: post.lang,
      slug: post.slug,
    });
    return `
        <li class="post-list__item">
          <a class="post-list__link" href="${href}">${
      escapeHtml(post.title)
    }</a>
          <time class="post-list__date" datetime="${post.date}">${
      escapeHtml(formatDate(post.date, post.lang))
    }</time>
          <p class="post-list__summary">${escapeHtml(post.summary)}</p>
        </li>`;
  }).join("");
  return `<ol class="post-list" role="list">${items}
      </ol>`;
}

/** A language with nothing published yet says so, rather than showing nothing. */
function emptyList(t: Translation): string {
  return `<p class="post-list__empty">${escapeHtml(t.blog.empty)}</p>`;
}

/** Home: the CV hero, then the language's latest writing. */
export function homeBody(
  t: Translation,
  lang: Lang,
  posts: readonly PostMeta[],
): string {
  const latest = byLang(posts, lang).slice(0, HOME_POST_COUNT);
  const body = latest.length === 0
    ? emptyList(t)
    : postList({ kind: "home", lang }, latest);
  return `
        ${hero(t)}
        <section class="section" aria-labelledby="latest">
          <div class="wrap">
            <h2 class="section__title animate" id="latest">${
    escapeHtml(t.blog.latest)
  }</h2>
            <div class="section__body animate animate--delayed-1">${body}</div>
          </div>
        </section>
      `;
}

/** The blog index: every post of the language, newest first. */
export function blogIndexBody(
  t: Translation,
  lang: Lang,
  posts: readonly PostMeta[],
): string {
  const list = byLang(posts, lang);
  const body = list.length === 0
    ? emptyList(t)
    : `<p class="section__intro">${escapeHtml(t.blog.indexIntro)}</p>${
      postList({ kind: "blogIndex", lang }, list)
    }`;
  return section(t, "writing", body);
}

/** One article: its already-safe body, its localized dates, a way back. */
export function postBody(
  t: Translation,
  lang: Lang,
  post: PostMeta,
  html: string,
): string {
  const back = hrefTo({ kind: "post", lang, slug: post.slug }, {
    kind: "blogIndex",
    lang,
  });
  const updated = post.updated
    ? ` · ${escapeHtml(t.blog.updated)} <time datetime="${post.updated}">${
      escapeHtml(formatDate(post.updated, lang))
    }</time>`
    : "";
  const tags = post.tags.length > 0
    ? `<p class="post__tags">${escapeHtml(t.blog.tags)}: ${
      post.tags.map(escapeHtml).join(", ")
    }</p>`
    : "";
  return `
        <article class="post">
          <header class="post__header">
            <h1 class="post__title">${escapeHtml(post.title)}</h1>
            <p class="post__meta">${escapeHtml(t.blog.published)}
              <time datetime="${post.date}">${
    escapeHtml(formatDate(post.date, lang))
  }</time>${updated}
            </p>
            ${tags}
          </header>
          <div class="post__body">${html}</div>
          <p class="post__back"><a href="${back}">${
    escapeHtml(t.blog.backToIndex)
  }</a></p>
        </article>
      `;
}

/**
 * Where the language switcher leads from a blog page. Home and index show the
 * same content in every language, so the target is just that page in the
 * other language. An article leads to its translation when one exists, and
 * otherwise to that language's index—flagged `missing`, which `nav()` turns
 * into a `.sr-only` note—so the switcher never links to a page that doesn't
 * exist.
 */
export function langLinkFor(
  page: Page,
  lang: Lang,
): (code: Lang) => LangLink {
  const from = pageRefOf(page, lang);
  if (page.kind !== "post") {
    return (code) => ({ href: hrefTo(from, pageRefOf(page, code)) });
  }
  const slug = page.post.slug;
  const translated = langsOf(page.posts, slug);
  return (code) => {
    const available = translated.includes(code);
    const to: PageRef = available
      ? { kind: "post", lang: code, slug }
      : { kind: "blogIndex", lang: code };
    return { href: hrefTo(from, to), missing: !available };
  };
}
