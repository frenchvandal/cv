/*
 * Pure, side-effect-free rendering. Every function takes data and returns an
 * HTML string — no DOM access — so the exact same code runs in two places:
 *   - the client ([src/main.ts](src/main.ts)) to (re)render on language change,
 *   - the static build ([scripts/build.ts](scripts/build.ts)) to pre-render each
 *     language page at build time (SEO, link previews, no-JS content).
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
} from "./translations";

export type Theme = "light" | "dark";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

function controls(t: Translation, lang: Lang, theme: Theme): string {
  const isLight = theme === "light";

  return `
    <nav class="controls" aria-label="${escapeHtml(t.ui.languageNav)}">
      ${
    LANGS.map(
      (code) => `
        <a href="${langUrl(code)}" hreflang="${
        HTML_LANG[code]
      }" data-lang="${code}"${
        lang === code ? ' aria-current="page"' : ""
      } aria-label="${escapeHtml(LANG_NAME[code])}">
          <span lang="${HTML_LANG[code]}">${LANG_LABEL[code]}</span>
        </a>`,
    ).join("")
  }
      <button type="button" class="controls__theme" data-theme-toggle aria-label="${
    escapeHtml(isLight ? t.ui.theme.dark : t.ui.theme.light)
  }">
        ${isLight ? "☾" : "☀"}
      </button>
    </nav>
  `;
}

function hero(t: Translation): string {
  return `
    <section class="hero" id="top" aria-label="Introduction">
      <div class="hero__eyebrow animate">${escapeHtml(t.hero.greeting)}</div>
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
      <p class="hero__title animate animate--delayed-3">
        ${escapeHtml(t.hero.title)}
      </p>
      <p class="hero__location animate animate--delayed-4">${
    escapeHtml(t.hero.location)
  }</p>
      <div class="hero__actions animate animate--delayed-5">
        <a class="button" href="#contact">${escapeHtml(t.hero.ctaPrimary)}</a>
        <a class="button button--ghost" href="#experience">${
    escapeHtml(t.hero.ctaSecondary)
  }</a>
      </div>
    </section>
  `;
}

function sectionTitle(
  t: Translation,
  id: keyof Translation["nav"],
  index: number,
): string {
  const label = `0${index + 1}`;
  return `<h2 class="section__title animate" id="${id}" tabindex="-1"><span aria-hidden="true">${label}</span>${
    escapeHtml(t.nav[id])
  }</h2>`;
}

/** Stat values are language-invariant; labels come from the translation. */
const STATS: readonly { value: string; label: (t: Translation) => string }[] = [
  { value: "20", label: (t) => t.about.stats.years },
  { value: "5", label: (t) => t.about.stats.languages },
  { value: "75", label: (t) => t.about.stats.defects },
  { value: "3", label: (t) => t.about.stats.clients },
];

function about(t: Translation): string {
  return `
    <section class="section" aria-labelledby="about">
      <div>${sectionTitle(t, "about", 0)}</div>
      <div class="section__body animate">
        <p class="kp">${escapeHtml(t.about.p1)}</p>
        <p class="kp">${escapeHtml(t.about.p2)}</p>
        <p class="kp">${escapeHtml(t.about.p3)}</p>
        <div class="stats animate">
          ${
    STATS.map(
      (stat) => `
          <div class="stat" data-count="${stat.value}">
            <div class="stat__label">${escapeHtml(stat.label(t))}</div>
            <div class="stat__value">${stat.value}</div>
          </div>`,
    ).join("")
  }
        </div>
      </div>
    </section>
  `;
}

/** A position with a bullet list (the two main chapters of the career). */
function jobCard(job: {
  title: string;
  company: string;
  date: string;
  items: readonly string[];
}): string {
  return `
        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(job.company)}</h3>
            <span class="card__meta">${escapeHtml(job.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(job.title)}</p>
          <ul class="card__list">
            ${job.items.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
          </ul>
        </article>`;
}

function experience(t: Translation): string {
  return `
    <section class="section" aria-labelledby="experience">
      <div>${sectionTitle(t, "experience", 1)}</div>
      <div class="section__body animate">
        ${jobCard(t.experience.kapia)}
        ${jobCard(t.experience.consulting)}

        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${
    escapeHtml(t.experience.insurance.company)
  }</h3>
            <span class="card__meta">${
    escapeHtml(t.experience.insurance.date)
  }</span>
          </div>
          <p class="card__subtitle">${
    escapeHtml(t.experience.insurance.title)
  }</p>
          <p>${escapeHtml(t.experience.insurance.desc)}</p>
        </article>
      </div>
    </section>
  `;
}

function education(t: Translation): string {
  return `
    <section class="section" aria-labelledby="education">
      <div>${sectionTitle(t, "education", 2)}</div>
      <div class="section__body animate">
        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${
    escapeHtml(t.education.sichuan.title)
  }</h3>
            <span class="card__meta">${
    escapeHtml(t.education.sichuan.date)
  }</span>
          </div>
          <p class="card__subtitle">${
    escapeHtml(t.education.sichuan.subtitle)
  }</p>
          <ul class="card__list">
            ${
    t.education.sichuan.items.map((c) => `<li>${escapeHtml(c)}</li>`).join("")
  }
          </ul>
        </article>

        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.education.master.title)}</h3>
            <span class="card__meta">${
    escapeHtml(t.education.master.date)
  }</span>
          </div>
          <p class="card__subtitle">${
    escapeHtml(t.education.master.subtitle)
  }</p>
          <p>${escapeHtml(t.education.master.desc)}</p>
        </article>

        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.education.edc.title)}</h3>
            <span class="card__meta">${escapeHtml(t.education.edc.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(t.education.edc.subtitle)}</p>
          <p>${escapeHtml(t.education.edc.desc)}</p>
        </article>
      </div>
    </section>
  `;
}

/** Certifications as their own chapter — one card, the section title carries the name. */
function certifications(t: Translation): string {
  return `
    <section class="section" aria-labelledby="certifications">
      <div>${sectionTitle(t, "certifications", 3)}</div>
      <div class="section__body animate">
        <article class="card">
          <div class="card__header">
            <span class="card__meta">${escapeHtml(t.certifications.date)}</span>
          </div>
          <ul class="card__list">
            ${
    t.certifications.items.map((c) => `<li>${escapeHtml(c)}</li>`).join("")
  }
          </ul>
        </article>
      </div>
    </section>
  `;
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
  return `
    <section class="section" aria-labelledby="skills">
      <div>${sectionTitle(t, "skills", 4)}</div>
      <div class="section__body animate">
        ${
    groups
      .map(
        (group) => `
          <div class="card">
            <h3 class="card__subtitle" style="margin-bottom: var(--space-xs)">${
          escapeHtml(group.title)
        }</h3>
            <div class="tags">
              ${
          group.tags.map((item) =>
            `<span class="tag">${escapeHtml(item)}</span>`
          ).join("")
        }
            </div>
          </div>`,
      )
      .join("")
  }
        <div class="card">
          <h3 class="card__subtitle" style="margin-bottom: var(--space-xs)">${
    escapeHtml(t.skills.languages.title)
  }</h3>
          <div class="tags">
            ${
    languages.map((l) =>
      `<span class="tag">${escapeHtml(l.name)} · ${escapeHtml(l.level)}</span>`
    ).join("")
  }
          </div>
        </div>
      </div>
    </section>
  `;
}

function hobbies(t: Translation): string {
  const items = [
    t.hobbies.running,
    t.hobbies.cycling,
    t.hobbies.literature,
    t.hobbies.cinema,
    t.hobbies.language,
  ];
  return `
    <section class="section" aria-labelledby="hobbies">
      <div>${sectionTitle(t, "hobbies", 5)}</div>
      <div class="section__body animate">
        ${
    items
      .map(
        (item) => `
          <article class="card">
            <h3 class="card__title">${escapeHtml(item.title)}</h3>
            <p style="color: var(--fg-muted)">${escapeHtml(item.desc)}</p>
          </article>`,
      )
      .join("")
  }
      </div>
    </section>
  `;
}

/**
 * The faux visitor interview, as iMessage-style bubbles. The pre-rendered
 * markup wraps at a plain CSS max-width (fine without JS); [src/chat.ts](src/chat.ts)
 * then tightens each bubble to its optimal wrap width with pretext. The bubble
 * text is duplicated into data-text so the enhancement measures exactly the
 * visible text (the .sr-only sender prefix is for screen readers only).
 */
function dialogue(t: Translation): string {
  return `
    <section class="section" aria-labelledby="dialogue">
      <div>${sectionTitle(t, "dialogue", 6)}</div>
      <div class="section__body animate">
        <p class="chat__disclaimer">${escapeHtml(t.dialogue.disclaimer)}</p>
        <div class="chat">
          ${
    t.dialogue.messages
      .map(
        (m) => `
          <div class="chat__row${m.me ? " chat__row--me" : ""}">
            <div class="msg" data-text="${
          escapeHtml(m.text)
        }"><span class="sr-only">${
          escapeHtml(m.me ? t.dialogue.me : t.dialogue.visitor)
        }: </span>${escapeHtml(m.text)}</div>
          </div>`,
      )
      .join("")
  }
        </div>
      </div>
    </section>
  `;
}

function contact(t: Translation): string {
  return `
    <section class="contact" aria-labelledby="contact">
      <h2 class="section__title animate" id="contact" style="margin-bottom: var(--space-lg)"><span aria-hidden="true">08</span>${
    escapeHtml(t.nav.contact)
  }</h2>
      <p class="animate" style="color: var(--fg-muted); margin-bottom: var(--space-md); max-width: 50rem">${
    escapeHtml(t.contact.intro)
  }</p>
      <div style="display: flex; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg)">
        <div>
          <p style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.1em">${
    escapeHtml(t.contact.wechatLabel)
  }</p>
          <p style="font-size: 1.5rem; font-weight: 700">${PROFILE.wechat}</p>
        </div>
        <div>
          <p style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.1em">${
    escapeHtml(t.contact.locationLabel)
  }</p>
          <p style="font-size: 1.5rem; font-weight: 700">${
    escapeHtml(t.hero.location)
  }</p>
        </div>
      </div>
    </section>
    <footer class="footer">
      <p>${escapeHtml(t.contact.footer)}</p>
    </footer>
  `;
}

/**
 * Back-to-top: a plain anchor to the hero (`#top`), so it works without JS —
 * CSS smooth scrolling and native fragment focus handling do the rest. With JS,
 * [src/main.ts](src/main.ts) only toggles its visibility once the hero scrolls out.
 */
function backToTop(t: Translation): string {
  return `
    <a class="back-to-top" href="#top" data-back-to-top aria-label="${
    escapeHtml(t.ui.backToTop)
  }">
      <span aria-hidden="true">↑</span>
    </a>
  `;
}

/** The full page markup for one language and theme. */
export function renderApp(lang: Lang, theme: Theme): string {
  const t = translations[lang];
  return `
    <div class="page" data-lang="${lang}">
      <a class="skip-link" href="#about">${escapeHtml(t.ui.skipLink)}</a>
      ${controls(t, lang, theme)}
      ${hero(t)}
      ${about(t)}
      ${experience(t)}
      ${education(t)}
      ${certifications(t)}
      ${skills(t)}
      ${hobbies(t)}
      ${dialogue(t)}
      ${contact(t)}
      ${backToTop(t)}
    </div>
  `;
}
