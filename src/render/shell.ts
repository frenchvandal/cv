/*
 * The chrome around the document: the sticky nav bar, the `section()` wrapper
 * every chapter shares, and the device the dialogue is drawn in. Split out of
 * [src/render.ts](src/render.ts)—the chapter bodies are in
 * [src/render/cv.ts](src/render/cv.ts), the page assembly in the facade.
 */

import {
  HTML_LANG,
  isLang,
  type Lang,
  LANG_LABEL,
  LANG_NAME,
  SWITCHER_LANGS,
  type Translation,
} from "../translations.ts";
import { escapeHtml } from "../dom.ts";
import {
  ICON_BATTERY,
  ICON_CHEVRON_LEFT,
  ICON_CHEVRON_RIGHT,
  ICON_SIGNAL,
  ICON_WIFI,
} from "../icons.ts";

export type Theme = "light" | "dark";

/**
 * Relative URL to a language's page. All six pages are siblings at the site
 * root (`index.html`, then `<lang>.html` for the rest), so the link is the
 * same from any page and works under any deploy path—no base tag, no absolute
 * origin.
 */
export function langUrl(lang: Lang): string {
  return lang === "en" ? "./" : `${lang}.html`;
}

/**
 * The language a URL path names, or null when it names none—the English root
 * (`/`, `/index.html`) and anything unrecognized. The exact inverse of
 * `langUrl`, kept beside it so the two can't drift apart, and pure so it is
 * testable without a document.
 *
 * Returning null rather than "en" is deliberate: "this path carries no language"
 * and "this path is English" are different facts, and only the caller knows
 * whether the default applies (on first load `<html data-lang>` answers first).
 */
export function langFromPath(path: string): Lang | null {
  // The last path segment, minus any trailing slash and .html—compared whole,
  // so `zh-hant.html` cannot be claimed by the shorter `zh` and `/french.html`
  // is not French. (This used to be a per-language regex ordered longest-slug-
  // first; an exact segment match removes the ordering subtlety entirely.)
  const segment = path.replace(/\/$/, "").split("/").pop() ?? "";
  const slug = segment.endsWith(".html")
    ? segment.slice(0, -".html".length)
    : segment;
  return isLang(slug) ? slug : null;
}

/**
 * The language a freshly loaded page is in, from the two facts the document
 * carries: the pre-rendered `<html data-lang>` and the URL. The attribute wins,
 * because it is what the markup on screen actually *is*; the URL only has to
 * answer for the dev shell, which is served at `/` with no `data-lang` of its
 * own. English is the fallback both miss.
 *
 * Startup only. `setLang` overwrites `data-lang` on every switch, so from the
 * first switch onward this would report the language already on screen—which
 * is exactly why back/forward reads `langFromPath` directly instead (see
 * `onPopState` in [src/main.ts](src/main.ts)). Split out of main.ts and taking
 * its two inputs as plain strings so the precedence is testable without a
 * document.
 */
export function pageLang(
  datasetLang: string | undefined,
  path: string,
): Lang {
  if (isLang(datasetLang)) return datasetLang;
  return langFromPath(path) ?? "en";
}

/**
 * Section shortcuts in the nav bar—a useful subset, not every heading.
 * Exported for the dev-only nav audit in [src/main.ts](src/main.ts), which has
 * to measure the same five labels the bar renders.
 */
export const NAV_LINKS: readonly (keyof Translation["nav"])[] = [
  "about",
  "experience",
  "education",
  "skills",
  "contact",
];

/**
 * A switcher target for one language. `missing` marks a fallback—the article
 * does not exist in that language—and gets an audible note, in .sr-only like
 * the endonym beside it (an attribute carries no language, RGAA 8.7).
 */
export interface LangLink {
  href: string;
  missing?: boolean;
}

export function nav(
  t: Translation,
  lang: Lang,
  theme: Theme,
  langLink?: (code: Lang) => LangLink,
): string {
  const isLight = theme === "light";

  const links = NAV_LINKS.map(
    (id) => `<a class="nav__link" href="#${id}">${escapeHtml(t.nav[id])}</a>`,
  ).join("");

  // zh-hk has no button of its own—it is Traditional Chinese, so the 繁 entry
  // is the one that represents the page a Hong Kong reader is on.
  const current = lang === "zh-hk" ? "zh-hant" : lang;

  // The endonym is the accessible name, but it cannot ride on an aria-label:
  // an attribute carries no language, so a French screen reader would read
  // 简体中文 in its own voice. As real text in a .sr-only span it gets a lang of
  // its own, which is what RGAA 8.7 asks for. The visible glyph is then
  // aria-hidden so the name stays the endonym alone, not "简 简体中文".
  const languages = SWITCHER_LANGS.map((code) => {
    // Blog pages pass langLink (same page in each language, or the index as
    // fallback); the CV keeps the historical sibling URLs.
    const link = langLink?.(code) ?? { href: langUrl(code) };
    const note = link.missing
      ? `<span class="sr-only"> (${escapeHtml(t.blog.notInLanguage)})</span>`
      : "";
    return `
        <a href="${link.href}" hreflang="${
      HTML_LANG[code]
    }" data-lang="${code}"${current === code ? ' aria-current="page"' : ""}>
          <span lang="${HTML_LANG[code]}" aria-hidden="true">${
      LANG_LABEL[code]
    }</span>
          <span class="sr-only" lang="${HTML_LANG[code]}">${
      escapeHtml(LANG_NAME[code])
    }</span>${note}
        </a>`;
  }).join("");

  return `
    <header class="nav">
      <div class="wrap nav__inner">
        <a class="nav__brand" href="#top">${escapeHtml(t.name.display)}</a>
        <nav class="nav__links" aria-label="${
    escapeHtml(t.ui.sectionsNav)
  }">${links}</nav>
        <div class="nav__actions">
          <nav class="nav__langs" aria-label="${
    escapeHtml(t.ui.languageNav)
  }">${languages}
          </nav>
          <button type="button" class="nav__theme" data-theme-toggle aria-label="${
    escapeHtml(isLight ? t.ui.theme.dark : t.ui.theme.light)
  }">${isLight ? "☾" : "☀"}</button>
        </div>
      </div>
    </header>
  `;
}

/**
 * A chapter of the document. The heading carries the hash id and labels the
 * section; `body` is already-escaped markup for the content column.
 */
export function section(
  t: Translation,
  id: keyof Translation["nav"],
  body: string,
  bodyClass = "section__body",
): string {
  return `
    <section class="section" aria-labelledby="${id}">
      <div class="wrap">
        <h2 class="section__title animate" id="${id}">${
    escapeHtml(t.nav[id])
  }</h2>
        <div class="${bodyClass} animate animate--delayed-1">${body}</div>
      </div>
    </section>
  `;
}

/**
 * The device the thread is drawn inside: status bar, conversation bar, and the
 * composer under it. Pure decoration—every part of it is `aria-hidden`, so a
 * screen reader hears the thread and nothing about the phone around it. `9:41`
 * is Apple's own canonical time and is language-invariant, as are the glyphs;
 * the only translated string is the contact name, which is the visitor, since
 * the screen we are looking over is Philippe's.
 */
export function phoneChrome(t: Translation): { status: string; bar: string } {
  const visitor = escapeHtml(t.dialogue.visitor);
  // The avatar monogram is the first *grapheme*, not the first UTF-16 unit, so
  // it stays whole for 訪客 as well as for Visitor.
  const monogram = escapeHtml([...t.dialogue.visitor][0] ?? "");

  return {
    status: `
            <div class="phone__status" aria-hidden="true">
              <span class="phone__time">9:41</span>
              <span class="phone__island"></span>
              <span class="phone__signals">${ICON_SIGNAL}${ICON_WIFI}${ICON_BATTERY}</span>
            </div>`,
    bar: `
            <div class="phone__bar" aria-hidden="true">
              <span class="phone__back">${ICON_CHEVRON_LEFT}</span>
              <span class="phone__who">
                <span class="phone__avatar">${monogram}</span>
                <span class="phone__name">${visitor}${ICON_CHEVRON_RIGHT}</span>
              </span>
            </div>`,
  };
}

/** CJK ideographs and CJK punctuation—the runs that need a declared language. */
const CJK_RUN = /[　-〿㐀-䶿一-鿿豈-﫿]+/g;

/**
 * RGAA 8.7: a run of Chinese inside a page written in another language has to
 * say so, or a screen reader pronounces it with the page's voice. Only the
 * dialogue needs this today (「微辣」in the English, French, Portuguese and
 * Spanish threads); on the Chinese pages there is no change of language to mark.
 *
 * Safe on already-escaped text: the CJK ranges cannot overlap an HTML entity,
 * so wrapping a run never lands inside one.
 */
export function markChinese(escaped: string, lang: Lang): string {
  if (lang.startsWith("zh")) return escaped;
  return escaped.replace(
    CJK_RUN,
    (run) => `<span lang="zh-Hans">${run}</span>`,
  );
}
