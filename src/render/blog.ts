/*
 * The blog pages: home, per-language index, and one page per article. Pure
 * string rendering like the rest of src/render—no DOM, no disk—so the static
 * build and the client share the same code.
 *
 * `post.html` arrives here ALREADY SAFE (scripts/markdown.ts produced and
 * validated it) and is inserted verbatim. Everything else—titles, summaries,
 * dates, tags—goes through escapeHtml.
 */

import { escapeHtml } from "../dom.ts";
import { byLang, HOME_POST_COUNT, langsOf, type PostMeta } from "../post.ts";
import { HTML_LANG, type Lang, type Translation } from "../translations.ts";
import { hrefTo, type PageRef } from "../urls.ts";
import { hero } from "./cv.ts";
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

/** Where a Page lives—the layout decides every path from these two facts. */
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
 * bare date is read in the build machine's zone and slips a day west of
 * Greenwich.
 */
function formatDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(HTML_LANG[lang], {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/*
 * The list is an <ol role="list">, like the CV timeline: the order is
 * significant, and role="list" restores the semantics that list-style: none
 * removes in Safari/VoiceOver.
 */
function postList(
  from: PageRef,
  posts: readonly PostMeta[],
): string {
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

function emptyList(t: Translation): string {
  return `<p class="post-list__empty">${escapeHtml(t.blog.empty)}</p>`;
}

/** Home: the CV hero, then the latest writing of the language. */
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

/** Blog index: every article of the language, newest first. */
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

/** One article: its rendered markup, its localized dates, a way back. */
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

/*
 * Where the language switcher leads from this page (spec §6.2). On home and
 * index every language has the same page, so the link is the same kind in the
 * other language. On an article it leads to the translation when one exists,
 * and to that language's index—flagged as missing, which nav() announces in
 * .sr-only—when it does not: never a dead link, never a missing page.
 */
export function langLinkFor(
  page: Page,
  lang: Lang,
): (code: Lang) => { href: string; missing: boolean } {
  const from = pageRefOf(page, lang);
  return (code) => {
    if (page.kind !== "post") {
      return { href: hrefTo(from, pageRefOf(page, code)), missing: false };
    }
    const available = langsOf(page.posts, page.post.slug).includes(code);
    const to: PageRef = available
      ? { kind: "post", lang: code, slug: page.post.slug }
      : { kind: "blogIndex", lang: code };
    return { href: hrefTo(from, to), missing: !available };
  };
}
