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
  type Lang,
  LANG_LABEL,
  LANG_NAME,
  LANGS,
  PROFILE,
  type Translation,
  translations,
} from "./translations.ts";
import { escapeHtml } from "./dom.ts";
import { LOGOS } from "./logos.ts";

export type Theme = "light" | "dark";

/**
 * Relative URL to a language's page. All four pages are siblings at the site
 * root (`index.html`, `fr.html`, `zh.html`, `zh-hant.html`), so the link is the
 * same from any page and works under any deploy path — no base tag, no absolute
 * origin.
 */
export function langUrl(lang: Lang): string {
  return lang === "en" ? "./" : `${lang}.html`;
}

/** Document title for a language's page — shared by the SSG build and the client. */
export function pageTitle(t: Translation): string {
  return `${t.name.display} — ${t.hero.title}`;
}

/** Section shortcuts in the nav bar — a useful subset, not every heading. */
const NAV_LINKS: readonly (keyof Translation["nav"])[] = [
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

  const languages = LANGS.map(
    (code) => `
        <a href="${langUrl(code)}" hreflang="${
      HTML_LANG[code]
    }" data-lang="${code}"${
      lang === code ? ' aria-current="page"' : ""
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
    <section class="hero wrap" id="top" aria-label="Introduction">
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
          <div class="stat" data-count="${stat.value}">
            <div class="stat__label">${escapeHtml(stat.label(t))}</div>
            <div class="stat__value">${stat.value}</div>
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

function experience(t: Translation): string {
  const { kapia, consulting, insurance } = t.experience;
  return section(
    t,
    "experience",
    timeline([
      {
        date: kapia.date,
        org: kapia.company,
        role: kapia.title,
        items: kapia.items,
        current: true,
      },
      {
        date: consulting.date,
        org: consulting.company,
        role: consulting.title,
        items: consulting.items,
      },
      {
        date: insurance.date,
        org: insurance.company,
        role: insurance.title,
        desc: insurance.desc,
      },
    ]),
    "section__body section__body--timeline",
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
        note: edc.subtitle,
        logo: LOGOS.edc,
        desc: edc.desc,
      },
    ], " timeline--marks"),
    "section__body section__body--timeline",
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
 * The faux visitor interview, presented as a message thread. The pre-rendered
 * bubbles wrap at a plain CSS max-width (fine without JS); [src/chat.ts] then
 * tightens each bubble to its optimal wrap width with pretext. The bubble text
 * is duplicated into data-text so the enhancement measures exactly the visible
 * text (the .sr-only sender prefix is for screen readers only).
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

  return section(
    t,
    "dialogue",
    `
        <p class="chat__disclaimer">${escapeHtml(t.dialogue.disclaimer)}</p>
        <div class="chat" role="group" aria-label="${
      escapeHtml(t.nav.dialogue)
    }">${rows}
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
            <p class="contact__value">${PROFILE.wechat}</p>
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
