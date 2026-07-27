/*
 * Pure, side-effect-free rendering. Every function takes data and returns an
 * HTML string — no DOM access — so the exact same code runs in two places:
 *   - the client ([src/main.ts](src/main.ts)) to (re)render on language change,
 *   - the static build ([scripts/build.ts](scripts/build.ts)) to pre-render each
 *     language page at build time (SEO, link previews, no-JS content).
 *
 * The page is an ordinary scrolling document: a sticky translucent nav bar, a
 * hero, then one `<section class="section">` per chapter, each holding a `.wrap`
 * content column. Nothing here depends on JS — the scripts only reveal sections
 * on scroll and refine typography. Every section is reachable by a stable hash
 * (`#experience`, …) carried by its heading, so deep links work everywhere.
 */

import {
  HTML_LANG,
  isLang,
  type Lang,
  LANG_LABEL,
  LANG_NAME,
  LANGS,
  PROFILE,
  PROFILE_URLS,
  SWITCHER_LANGS,
  type Translation,
  translations,
} from "./translations.ts";
import { escapeHtml } from "./dom.ts";
import { LOGOS } from "./logos.ts";
import {
  ICON_BATTERY,
  ICON_CHEVRON_LEFT,
  ICON_CHEVRON_RIGHT,
  ICON_MIC,
  ICON_PLUS,
  ICON_SIGNAL,
  ICON_WIFI,
} from "./icons.ts";
import { CHAT_WIDTH } from "./config.ts";

export type Theme = "light" | "dark";

/**
 * Relative URL to a language's page. All six pages are siblings at the site
 * root (`index.html`, then `<lang>.html` for the rest), so the link is the
 * same from any page and works under any deploy path — no base tag, no absolute
 * origin.
 */
export function langUrl(lang: Lang): string {
  return lang === "en" ? "./" : `${lang}.html`;
}

/**
 * The language a URL path names, or null when it names none — the English root
 * (`/`, `/index.html`) and anything unrecognized. The exact inverse of
 * `langUrl`, kept beside it so the two can't drift apart, and pure so it is
 * testable without a document.
 *
 * Returning null rather than "en" is deliberate: "this path carries no language"
 * and "this path is English" are different facts, and only the caller knows
 * whether the default applies (on first load `<html data-lang>` answers first).
 */
export function langFromPath(path: string): Lang | null {
  // The last path segment, minus any trailing slash and .html — compared whole,
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
 * first switch onward this would report the language already on screen — which
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

/** localStorage key holding a language the visitor picked by hand. */
export const STORAGE_LANG_KEY = "cv-lang";

/**
 * The `<head>` script that sends a visitor arriving at the site ROOT to the
 * page in their language. Injected by [scripts/build.ts](scripts/build.ts) into
 * `index.html` only — a URL that names a language (`fr.html`) must always be
 * honoured, or shared links would silently change language on the recipient.
 *
 * It runs inline, before the body renders, and uses `location.replace` so the
 * root never becomes a history entry: without that, Back from the language page
 * would land on the root, be redirected again, and the button would look broken.
 *
 * A hand-picked language (localStorage) outranks the browser's list, so the
 * switcher is always the last word. English needs no redirect — it is what the
 * root already serves.
 *
 * Tags match on their primary subtag, so `fr-CA` reads French and `es-MX` reads
 * the (peninsular) Spanish page: a regional mismatch is still the right
 * language, and far better than English.
 *
 * Chinese is the exception, because there the primary subtag decides neither
 * script nor vocabulary, and the subtags can arrive in any combination
 * (`zh-HK`, `zh-Hant-HK`, `zh-Hans-HK`…). Hence, in order:
 *   - an explicit `Hans` wins outright — `zh-Hans-HK` is a Simplified reader who
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
 * `yue` (Cantonese) is deliberately NOT mapped: it falls through to English
 * like any other unsupported tag, and the reader picks a language from the
 * switcher.
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
        } else if (urls[primary]) {
          pick = primary;
        }
      }
    }
    if (pick && pick !== "en") location.replace(urls[pick]);
  } catch (e) {}
})();
</script>`;
}

/** Document title for a language's page — shared by the SSG build and the client. */
export function pageTitle(t: Translation): string {
  return `${t.name.display} — ${t.hero.title}`;
}

/**
 * Section shortcuts in the nav bar — a useful subset, not every heading.
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

function nav(t: Translation, lang: Lang, theme: Theme): string {
  const isLight = theme === "light";

  const links = NAV_LINKS.map(
    (id) => `<a class="nav__link" href="#${id}">${escapeHtml(t.nav[id])}</a>`,
  ).join("");

  // zh-hk has no button of its own — it is Traditional Chinese, so the 繁 entry
  // is the one that represents the page a Hong Kong reader is on.
  const current = lang === "zh-hk" ? "zh-hant" : lang;

  const languages = SWITCHER_LANGS.map(
    (code) => `
        <a href="${langUrl(code)}" hreflang="${
      HTML_LANG[code]
    }" data-lang="${code}"${
      current === code ? ' aria-current="page"' : ""
    } aria-label="${escapeHtml(LANG_NAME[code])}">
          <span lang="${HTML_LANG[code]}">${LANG_LABEL[code]}</span>
        </a>`,
  ).join("");

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

function hero(t: Translation): string {
  return `
    <section class="hero wrap" id="top" aria-label="${escapeHtml(t.ui.intro)}">
      <p class="hero__eyebrow animate">${escapeHtml(t.hero.greeting)}</p>
      <h1 class="hero__name">
        ${
    t.name.lines
      .map(
        (line, i) =>
          `<span class="hero__name-line animate animate--delayed-${i + 1}">${
            escapeHtml(line)
          }</span>`,
      )
      .join("\n        ")
  }
      </h1>
      <p class="hero__title animate animate--delayed-3">${
    escapeHtml(t.hero.title)
  }</p>
      <p class="hero__location animate animate--delayed-4">${
    escapeHtml(t.hero.location)
  }</p>
      <div class="hero__actions animate animate--delayed-5">
        <a class="button" href="#contact">${escapeHtml(t.hero.ctaPrimary)}</a>
        <a class="button button--plain" href="#about">${
    escapeHtml(t.hero.ctaSecondary)
  }</a>
      </div>
    </section>
  `;
}

/**
 * A chapter of the document. The heading carries the hash id and labels the
 * section; `body` is already-escaped markup for the content column.
 */
function section(
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

/** Stat values are language-invariant; labels come from the translation. */
const STATS: readonly { value: string; label: (t: Translation) => string }[] = [
  { value: "20", label: (t) => t.about.stats.years },
  { value: "5", label: (t) => t.about.stats.languages },
  { value: "75", label: (t) => t.about.stats.defects },
  { value: "3", label: (t) => t.about.stats.clients },
];

/**
 * About, closed by the numbers as a hairline-divided spec strip. The figures
 * support the prose, so they share its section instead of interrupting the
 * document with a heading of their own.
 */
function about(t: Translation): string {
  const stats = STATS.map(
    (stat) => `
          <div class="stat" data-count="${escapeHtml(stat.value)}">
            <div class="stat__label">${escapeHtml(stat.label(t))}</div>
            <div class="stat__value">${escapeHtml(stat.value)}</div>
          </div>`,
  ).join("");

  return section(
    t,
    "about",
    `
        <p class="kp">${escapeHtml(t.about.p1)}</p>
        <p class="kp">${escapeHtml(t.about.p2)}</p>
        <p class="kp">${escapeHtml(t.about.p3)}</p>
        <div class="stats" style="margin-top: var(--space-xl)">${stats}
        </div>`,
  );
}

/**
 * One event on a timeline: when it happened, where, in what role, and what came
 * of it. Careers and studies are both sequences, so they share the shape.
 */
type TimelineEntry = {
  /** Free text, not a machine date — the ranges read "2011 – 2014 · 2019 – Present". */
  date: string;
  /** The employer or the institution — the event's heading. */
  org: string;
  /** The role held, or the diploma earned. */
  role: string;
  /** An aside neither the heading nor the role should carry. */
  note?: string;
  /** Trusted inline SVG from [src/logos.ts](src/logos.ts); see `timelineItem`. */
  logo?: string;
  /** Experience only: "City, Country" and the employer's sector, in that order. */
  location?: string;
  sector?: string;
  items?: readonly string[];
  desc?: string;
  /** The one event still running — the only node drawn in the accent. */
  current?: boolean;
};

/**
 * An event, rendered as Ant Design's Timeline item read through the HIG.
 *
 * Ant's structure survives — a rail, one node per event, the content beside it,
 * dates in their own column (Ant's `label` mode, on wide viewports only). Its
 * decoration does not: the node is a hairline ring in the neutral ramp, the
 * filled accent node is spent on the single fact it can carry (which role is
 * still running), and the content sits on the page instead of in a card, so
 * the rail is the only structure the reader has to parse.
 *
 * `logo` is trusted static markup and is inlined unescaped; it is decorative,
 * since the heading right under it already names the school, so the wrapper
 * hides it from assistive tech rather than letting the SVG's own label announce
 * the name a second time.
 *
 * `index` only staggers the reveal, reusing the shared `animate--delayed-*`
 * steps — the events fade in top to bottom, the way the rail is read.
 */
function timelineItem(entry: TimelineEntry, index: number): string {
  const detail = entry.items
    ? `<ul class="timeline__list">${
      entry.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    }</ul>`
    : entry.desc
    ? `<p class="timeline__text">${escapeHtml(entry.desc)}</p>`
    : "";

  return `
          <li class="timeline__item${
    entry.current ? " timeline__item--current" : ""
  } animate animate--delayed-${index + 1}">
            <span class="timeline__date">${escapeHtml(entry.date)}</span>
            <div class="timeline__rail" aria-hidden="true"><span class="timeline__node"></span></div>
            <div class="timeline__body">
              ${
    entry.logo
      ? `<div class="timeline__logo" aria-hidden="true">${entry.logo}</div>`
      : ""
  }
              <h3 class="timeline__org">${escapeHtml(entry.org)}</h3>
              ${
    entry.location
      ? `<p class="timeline__meta">${escapeHtml(entry.location)}</p>`
      : ""
  }
              ${
    entry.sector
      ? `<p class="timeline__meta">${escapeHtml(entry.sector)}</p>`
      : ""
  }
              <p class="timeline__role">${escapeHtml(entry.role)}</p>
              ${
    entry.note ? `<p class="timeline__note">${escapeHtml(entry.note)}</p>` : ""
  }
              ${detail}
            </div>
          </li>`;
}

/**
 * The rail itself. `role="list"` restores the semantics that `list-style: none`
 * strips in Safari/VoiceOver, and the ordering is meaningful — an `<ol>`.
 */
function timeline(entries: readonly TimelineEntry[], modifier = ""): string {
  return `
        <ol class="timeline${modifier}" role="list">${
    entries.map(timelineItem).join("")
  }
        </ol>`;
}

/** Reverse-chronological; the first entry is the role still running. */
const EXPERIENCE: readonly (keyof Translation["experience"])[] = [
  "kapiaRgi",
  "open",
  "kapiaSolutions",
  "adneom",
  "insurance",
];

/**
 * Every employer is described by the same four levels — company (carrying its
 * current name in parentheses when it has been renamed), city, sector, role —
 * so the entries are a projection rather than five hand-written literals.
 */
function experience(t: Translation): string {
  return section(
    t,
    "experience",
    timeline(EXPERIENCE.map((key, index) => {
      const entry = t.experience[key];
      return {
        date: entry.date,
        org: entry.company,
        location: entry.location,
        sector: entry.sector,
        role: entry.title,
        current: index === 0,
      };
    })),
    "section__body",
  );
}

/**
 * The same rail, opened by each institution's mark instead of its name. The
 * marks are taller than a line of text, so `timeline--marks` re-centres the
 * node and the date on them (see src/styles.css).
 */
function education(t: Translation): string {
  const { sichuan, master, edc } = t.education;
  return section(
    t,
    "education",
    timeline([
      {
        date: sichuan.date,
        org: sichuan.school,
        role: sichuan.title,
        note: sichuan.subtitle,
        logo: LOGOS.sichuan,
        items: sichuan.items,
      },
      {
        date: master.date,
        org: master.school,
        role: master.title,
        note: master.subtitle,
        logo: LOGOS.master,
        desc: master.desc,
      },
      {
        date: edc.date,
        org: edc.school,
        role: edc.title,
        logo: LOGOS.edc,
        desc: edc.desc,
      },
    ], " timeline--marks"),
    "section__body",
  );
}

function certifications(t: Translation): string {
  return section(
    t,
    "certifications",
    `
        <article class="card">
          <div class="card__header">
            <span class="card__meta">${escapeHtml(t.certifications.date)}</span>
          </div>
          <ul class="card__list">${
      t.certifications.items.map((c) => `<li>${escapeHtml(c)}</li>`).join("")
    }</ul>
        </article>`,
  );
}

function skills(t: Translation): string {
  const groups = [
    t.skills.product,
    t.skills.data,
    t.skills.interfaces,
    t.skills.domains,
    t.skills.soft,
  ];
  const languages = [
    t.skills.languages.french,
    t.skills.languages.portuguese,
    t.skills.languages.english,
    t.skills.languages.spanish,
    t.skills.languages.mandarin,
  ];

  const cards = groups.map(
    (group) => `
        <div class="card">
          <h3 class="card__title">${escapeHtml(group.title)}</h3>
          <div class="tags">${
      group.tags.map((item) => `<span class="tag">${escapeHtml(item)}</span>`)
        .join("")
    }</div>
        </div>`,
  ).join("");

  return section(
    t,
    "skills",
    `${cards}
        <div class="card">
          <h3 class="card__title">${escapeHtml(t.skills.languages.title)}</h3>
          <div class="tags">${
      languages.map((l) =>
        `<span class="tag">${escapeHtml(l.name)} · ${
          escapeHtml(l.level)
        }</span>`
      ).join("")
    }</div>
        </div>`,
    "section__body section__body--cards",
  );
}

function hobbies(t: Translation): string {
  const items = [
    t.hobbies.running,
    t.hobbies.cycling,
    t.hobbies.literature,
    t.hobbies.cinema,
    t.hobbies.language,
  ];
  return section(
    t,
    "hobbies",
    items.map(
      (item) => `
        <article class="card">
          <h3 class="card__title">${escapeHtml(item.title)}</h3>
          <p class="card__text">${escapeHtml(item.desc)}</p>
        </article>`,
    ).join(""),
    "section__body section__body--cards",
  );
}

/**
 * The device the thread is drawn inside: status bar, conversation bar, and the
 * composer under it. Pure decoration — every part of it is `aria-hidden`, so a
 * screen reader hears the thread and nothing about the phone around it. `9:41`
 * is Apple's own canonical time and is language-invariant, as are the glyphs;
 * the only translated string is the contact name, which is the visitor, since
 * the screen we are looking over is Philippe's.
 */
function phoneChrome(t: Translation): { status: string; bar: string } {
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

/**
 * The faux visitor interview, presented as a message thread on a phone.
 *
 * The bubbles are the load-bearing part: they wrap at a plain CSS max-width
 * (fine without JS), and [src/chat.ts](src/chat.ts) then tightens each one to
 * its optimal wrap width with pretext. The bubble text is duplicated into
 * data-text so the enhancement measures exactly the visible text (the .sr-only
 * sender prefix is for screen readers only).
 *
 * The phone around them is what makes the thread read as a thread rather than
 * as two columns of coloured boxes. Its screen is a fixed 19.5:9, so the thread
 * scrolls inside it as it would on the device — which is why `.chat` carries
 * `tabindex="0"`: a scrollable region has to be reachable by keyboard, and the
 * `role="group"` it already had does not make it focusable. The width control is the
 * pretext demo's own (chenglou.me/pretext/bubbles): dragging it re-tightens
 * every bubble live, which is the whole point of measuring instead of
 * guessing. It is `.js`-gated in CSS, since a range input that moves nothing
 * would be a lie without the script.
 */
function dialogue(t: Translation): string {
  const rows = t.dialogue.messages.map(
    (m) => `
              <div class="chat__row${m.me ? " chat__row--me" : ""}">
                <div class="msg" data-text="${
      escapeHtml(m.text)
    }"><span class="sr-only">${
      escapeHtml(m.me ? t.dialogue.me : t.dialogue.visitor)
    }: </span>${escapeHtml(m.text)}</div>
              </div>`,
  ).join("");

  const { status, bar } = phoneChrome(t);

  return section(
    t,
    "dialogue",
    `
        <p class="chat__disclaimer">${escapeHtml(t.dialogue.disclaimer)}</p>
        <div class="phone">
          <div class="phone__body">
            <div class="phone__screen">${status}${bar}
              <div
                class="chat"
                role="group"
                aria-label="${escapeHtml(t.nav.dialogue)}"
                tabindex="0"
              >${rows}
              </div>
              <div class="phone__composer" aria-hidden="true">
                <span class="phone__plus">${ICON_PLUS}</span>
                <span class="phone__field">${ICON_MIC}</span>
              </div>
              <span class="phone__home" aria-hidden="true"></span>
            </div>
          </div>
          <label class="chat__width">
            <span class="chat__width-name">${
      escapeHtml(t.dialogue.width)
    }</span>
            <input
              class="chat__width-range"
              type="range"
              min="${CHAT_WIDTH.min}"
              max="${CHAT_WIDTH.max}"
              value="${CHAT_WIDTH.initial}"
              step="1"
              data-chat-width
            />
            <output class="chat__width-value" data-chat-width-value>${CHAT_WIDTH.initial} px</output>
          </label>
        </div>`,
  );
}

function contact(t: Translation): string {
  return section(
    t,
    "contact",
    `
        <p class="contact__intro">${escapeHtml(t.contact.intro)}</p>
        <div class="contact__grid">
          <div>
            <p class="contact__label">${escapeHtml(t.contact.wechatLabel)}</p>
            <p class="contact__value">${escapeHtml(PROFILE.wechat)}</p>
          </div>
          <div>
            <p class="contact__label">${escapeHtml(t.contact.githubLabel)}</p>
            <p class="contact__value"><a href="${
      escapeHtml(PROFILE_URLS.github)
    }" rel="me">${escapeHtml(`@${PROFILE.github}`)}</a></p>
          </div>
          <div>
            <p class="contact__label">${escapeHtml(t.contact.linkedinLabel)}</p>
            <p class="contact__value"><a href="${
      escapeHtml(PROFILE_URLS.linkedin)
    }" rel="me">${escapeHtml(`in/${PROFILE.linkedin}`)}</a></p>
          </div>
          <div>
            <p class="contact__label">${escapeHtml(t.contact.locationLabel)}</p>
            <p class="contact__value">${escapeHtml(t.hero.location)}</p>
          </div>
        </div>
        <button
          class="button button--copy"
          type="button"
          data-copy-wechat
          data-copied-label="${escapeHtml(t.ui.copied)}"
          aria-live="polite"
        >${escapeHtml(t.ui.copyWechat)}</button>`,
  );
}

/** The full page markup for one language and theme. */
export function renderApp(lang: Lang, theme: Theme): string {
  const t = translations[lang];
  return `
    <div class="page" data-lang="${lang}">
      <a class="skip-link" href="#main">${escapeHtml(t.ui.skipLink)}</a>
      ${nav(t, lang, theme)}
      <main id="main">
        ${hero(t)}
        ${about(t)}
        ${experience(t)}
        ${education(t)}
        ${certifications(t)}
        ${skills(t)}
        ${hobbies(t)}
        ${dialogue(t)}
        ${contact(t)}
      </main>
      <footer class="footer">
        <div class="wrap">${escapeHtml(t.contact.footer)}</div>
      </footer>
    </div>
  `;
}
