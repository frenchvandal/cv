/*
 * The chrome around the document: the sticky nav bar, the `section()` wrapper
 * every chapter shares, and the device the dialogue is drawn in. Split out of
 * [src/render.ts](src/render.ts)—the chapter bodies are in
 * [src/render/cv.ts](src/render/cv.ts), the page assembly in the facade.
 */

import {
  HTML_LANG,
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
 * Where the switcher leads for one language, as decided by the caller.
 * `missing` marks a fallback (a blog post with no translation, sent to that
 * language's index instead)—see `nav`'s doc comment.
 */
export interface LangLink {
  href: string;
  missing?: boolean;
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

/** One entry in the nav bar: where it goes, and what it is called. */
export interface NavLink {
  href: string;
  label: string;
}

/**
 * The bar every page carries. Nothing in it is decided here, because nothing
 * in it is the same on every page:
 *
 * @param langLink Where the switcher leads, per language. The same page in
 * each language — or, on an article with no translation, that language's
 * index, flagged `missing`. Never a dead link, never a missing page.
 * @param navLinks The shortcuts. On the CV they are in-page anchors to its
 * chapters; everywhere else those anchors would point at sections that do not
 * exist on the page, so the caller passes site-level links instead.
 * @param brandHref Where the name leads. `#top` only resolves on the CV, whose
 * hero carries that id; every other page sends the reader to its home.
 */
export function nav(
  t: Translation,
  lang: Lang,
  theme: Theme,
  langLink: (code: Lang) => LangLink,
  navLinks: readonly NavLink[],
  brandHref: string,
): string {
  const isLight = theme === "light";

  const links = navLinks.map(
    (link) =>
      `<a class="nav__link" href="${link.href}">${escapeHtml(link.label)}</a>`,
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
    const link = langLink(code);
    // Same rule as the endonym above: the "not translated" note is read
    // content, in the page's own language, not an aria-label—an attribute
    // still carries no language.
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
        <a class="nav__brand" href="${brandHref}">${
    escapeHtml(t.name.display)
  }</a>
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
const CJK_RUN = /[　-〿㐀-䶿一-鿿豈-﫿]+/g;

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
