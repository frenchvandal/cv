/*
 * Pure, side-effect-free rendering. Every function takes data and returns an
 * HTML string—no DOM access—so the exact same code runs in two places:
 *   - the client ([src/main.ts](src/main.ts)) to (re)render on language change,
 *   - the static build ([scripts/build.ts](scripts/build.ts)) to pre-render each
 *     language page at build time (SEO, link previews, no-JS content).
 *
 * The page is an ordinary scrolling document: a sticky translucent nav bar, a
 * hero, then one `<section class="section">` per chapter, each holding a `.wrap`
 * content column. Nothing here depends on JS—the scripts only reveal sections
 * on scroll and refine typography. Every section is reachable by a stable hash
 * (`#experience`, …) carried by its heading, so deep links work everywhere.
 *
 * This module is the facade: the language negotiation script and the page
 * assembly (`renderApp`) live here; the chrome and the URL helpers are
 * [src/render/shell.ts](src/render/shell.ts) and the chapters are
 * [src/render/cv.ts](src/render/cv.ts). `langUrl`, `langFromPath`, `pageLang`,
 * `NAV_LINKS` and `Theme` are re-exported so existing importers keep working
 * unchanged.
 */

import {
  type Lang,
  LANGS,
  type Translation,
  translations,
} from "./translations.ts";
import { escapeHtml } from "./dom.ts";
import { langUrl, nav, type Theme } from "./render/shell.ts";
import {
  about,
  certifications,
  contact,
  dialogue,
  education,
  experience,
  hero,
  hobbies,
  skills,
} from "./render/cv.ts";

import {
  blogIndexBody,
  homeBody,
  langLinkFor,
  type Page,
  postBody,
} from "./render/blog.ts";

export {
  langFromPath,
  langUrl,
  NAV_LINKS,
  pageLang,
  type Theme,
} from "./render/shell.ts";
export { pageRefOf } from "./render/blog.ts";
export type { Page } from "./render/blog.ts";

/** localStorage key holding a language the visitor picked by hand. */
export const STORAGE_LANG_KEY = "cv-lang";

/**
 * The `<head>` script that sends a visitor arriving at the site ROOT to the
 * page in their language. Injected by [scripts/build.ts](scripts/build.ts) into
 * `index.html` only—a URL that names a language (`fr.html`) must always be
 * honoured, or shared links would silently change language on the recipient.
 *
 * It runs inline, before the body renders, and uses `location.replace` so the
 * root never becomes a history entry: without that, Back from the language page
 * would land on the root, be redirected again, and the button would look broken.
 *
 * A hand-picked language (localStorage) outranks the browser's list, so the
 * switcher is always the last word. English needs no redirect—it is what the
 * root already serves.
 *
 * Tags match on their primary subtag, so `fr-CA` reads French and `es-MX` reads
 * the (peninsular) Spanish page: a regional mismatch is still the right
 * language, and far better than English.
 *
 * Chinese is the exception, because there the primary subtag decides neither
 * script nor vocabulary, and the subtags can arrive in any combination
 * (`zh-HK`, `zh-Hant-HK`, `zh-Hans-HK`…). Hence, in order:
 *   - an explicit `Hans` wins outright—`zh-Hans-HK` is a Simplified reader who
 *     merely lives in Hong Kong, and must not be handed Traditional;
 *   - `HK`/`MO` then take the Hong Kong page, checked before the broader
 *     Traditional test, which would otherwise swallow them;
 *   - `Hant`/`TW` take the Taiwan page;
 *   - bare `zh` gets Simplified, which has by far the most readers.
 *
 * Which resolves the nine tags a browser can actually send:
 *
 *   zh-Hans, zh-Hans-CN, zh-Hans-HK, zh-Hans-MO, zh-Hans-SG → zh.html
 *   zh-Hant, zh-Hant-TW                                     → zh-hant.html
 *   zh-Hant-HK, zh-Hant-MO                                  → zh-hk.html
 *
 * plus the older region-only forms (`zh-CN`, `zh-TW`, `zh-HK`, `zh-MO`,
 * `zh-SG`), which many devices still send and which land the same way.
 *
 * `yue` (Cantonese) is a language, not a script: nothing in the tag says
 * whether its reader writes Traditional or Simplified, so only the region can
 * decide. `yue-HK`/`yue-MO` are Hong Kong and Macau, which is exactly the page
 * `zh-hk` was written for; `yue-CN` is a Guangdong reader, who writes
 * Simplified, and bare `yue` names no region at all. Those two fall through to
 * English like any other unsupported tag rather than guess a script, and the
 * reader picks a language from the switcher.
 *
 * This is plain ES5 in a string because it must run before the bundle exists.
 * [src/render.test.ts](src/render.test.ts) executes this exact generated source
 * against a stubbed browser, so the shipped rule is the tested one.
 */
export function languageNegotiationScript(): string {
  const urls = Object.fromEntries(LANGS.map((lang) => [lang, langUrl(lang)]));
  return `<script>
(function () {
  try {
    var urls = ${JSON.stringify(urls).replace(/</g, "\\u003C")};
    var pick = null;
    try {
      var saved = localStorage.getItem(${JSON.stringify(STORAGE_LANG_KEY)});
      if (saved && urls[saved]) pick = saved;
    } catch (e) {}
    if (!pick) {
      var list = navigator.languages || [navigator.language || ""];
      for (var i = 0; i < list.length && !pick; i++) {
        var parts = String(list[i]).toLowerCase().split("-");
        var primary = parts[0];
        if (primary === "zh") {
          pick = parts.indexOf("hans") > 0
            ? "zh"
            : parts.indexOf("hk") > 0 || parts.indexOf("mo") > 0
            ? "zh-hk"
            : parts.indexOf("hant") > 0 || parts.indexOf("tw") > 0
            ? "zh-hant"
            : "zh";
        } else if (primary === "yue") {
          if (parts.indexOf("hk") > 0 || parts.indexOf("mo") > 0) pick = "zh-hk";
        } else if (urls[primary]) {
          pick = primary;
        }
      }
    }
    if (pick && pick !== "en") location.replace(urls[pick] + location.search + location.hash);
  } catch (e) {}
})();
</script>`;
}

/** Document title for a language's page—shared by the SSG build and the client. */
export function pageTitle(t: Translation): string {
  return `${t.name.display} — ${t.hero.title}`;
}

/*
 * The CV chapters, in document order. Kept as one interpolated chunk so
 * renderApp's output stays byte-identical to what it was before the split:
 * first paint must match the pre-rendered markup exactly (hydration).
 */
function cvBody(t: Translation, lang: Lang): string {
  return `
        ${hero(t)}
        ${about(t)}
        ${experience(t)}
        ${education(t)}
        ${certifications(t)}
        ${skills(t)}
        ${hobbies(t)}
        ${dialogue(t, lang)}
        ${contact(t)}
      `;
}

/** The full page markup for one page kind, one language and one theme. */
export function renderPage(page: Page, lang: Lang, theme: Theme): string {
  const t = translations[lang];
  const body = page.kind === "home"
    ? homeBody(t, lang, page.posts)
    : page.kind === "blogIndex"
    ? blogIndexBody(t, lang, page.posts)
    : page.kind === "post"
    ? postBody(t, lang, page.post, page.html)
    : cvBody(t, lang);
  return `
    <div class="page" data-lang="${lang}" data-kind="${page.kind}">
      <a class="skip-link" href="#main">${escapeHtml(t.ui.skipLink)}</a>
      ${
    nav(
      t,
      lang,
      theme,
      page.kind === "cv" ? undefined : langLinkFor(page, lang),
    )
  }
      <main id="main">${body}</main>
      <footer class="footer">
        <div class="wrap">${escapeHtml(t.contact.footer)}</div>
      </footer>
    </div>
  `;
}

/** The CV page—what this site rendered before the blog existed. */
export function renderApp(lang: Lang, theme: Theme): string {
  return renderPage({ kind: "cv" }, lang, theme);
}
