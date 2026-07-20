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

/** A position: header, role, and either bullets or a paragraph. */
function jobCard(job: {
  title: string;
  company: string;
  date: string;
  items?: readonly string[];
  desc?: string;
}): string {
  const detail = job.items
    ? `<ul class="card__list">${
      job.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    }</ul>`
    : job.desc
    ? `<p class="card__text">${escapeHtml(job.desc)}</p>`
    : "";

  return `
        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(job.company)}</h3>
            <span class="card__meta">${escapeHtml(job.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(job.title)}</p>
          ${detail}
        </article>`;
}

function experience(t: Translation): string {
  return section(
    t,
    "experience",
    [
      jobCard(t.experience.kapia),
      jobCard(t.experience.consulting),
      jobCard(t.experience.insurance),
    ].join(""),
  );
}

/**
 * One card per institution: its logo, its name, then the diploma earned there.
 *
 * `logo` is trusted static markup from [src/logos.ts](src/logos.ts) and is
 * inlined unescaped; it is decorative here, since the heading right under it
 * already names the school, so the wrapper hides it from assistive tech rather
 * than letting the SVG's own label announce the name a second time.
 *
 * A school with no logo still gets the (empty) slot: the cards sit in one grid
 * row, so dropping the box would lift that card's heading above the others.
 */
function schoolCard(logo: string | null, school: {
  school: string;
  title: string;
  date: string;
  subtitle: string;
  items?: readonly string[];
  desc?: string;
}): string {
  const detail = school.items
    ? `<ul class="card__list">${
      school.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    }</ul>`
    : school.desc
    ? `<p class="card__text">${escapeHtml(school.desc)}</p>`
    : "";

  return `
        <article class="card card--school">
          <div class="card__logo" aria-hidden="true">${logo ?? ""}</div>
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(school.school)}</h3>
            <span class="card__meta">${escapeHtml(school.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(school.title)}</p>
          ${
    school.subtitle
      ? `<p class="card__note">${escapeHtml(school.subtitle)}</p>`
      : ""
  }
          ${detail}
        </article>`;
}

function education(t: Translation): string {
  const { sichuan, master, edc } = t.education;
  return section(
    t,
    "education",
    [
      schoolCard(LOGOS.sichuan, sichuan),
      schoolCard(LOGOS.master, master),
      // No EDC vector yet — see the note in src/logos.ts.
      schoolCard(null, edc),
    ].join("\n"),
    "section__body section__body--cards",
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
