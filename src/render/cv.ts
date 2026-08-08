/*
 * The chapters of the CV page, from the hero to the contact block. Pure string
 * rendering over the translation objects; the chrome they slot into is
 * [src/render/shell.ts](src/render/shell.ts), and the page assembly is
 * `renderApp` in [src/render.ts](src/render.ts).
 */

import {
  type Lang,
  PROFILE,
  PROFILE_URLS,
  type Translation,
} from "../translations.ts";
import { escapeHtml } from "../dom.ts";
import { LOGOS } from "../logos.ts";
import { ICON_MIC, ICON_PLUS } from "../icons.ts";
import { CHAT_WIDTH } from "../config.ts";
import { markChinese, phoneChrome, section } from "./shell.ts";

export function hero(t: Translation): string {
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
export function about(t: Translation): string {
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
  /** Free text, not a machine date—the ranges read "2011 – 2014 · 2019 – Present". */
  date: string;
  /** The employer or the institution—the event's heading. */
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
  /** The one event still running—the only node drawn in the accent. */
  current?: boolean;
};

/**
 * An event, rendered as Ant Design's Timeline item read through the HIG.
 *
 * Ant's structure survives—a rail, one node per event, the content beside it,
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
 * steps—the events fade in top to bottom, the way the rail is read.
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
 * strips in Safari/VoiceOver, and the ordering is meaningful—an `<ol>`.
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
 * Every employer is described by the same four levels—company (carrying its
 * current name in parentheses when it has been renamed), city, sector, role—
 * so the entries are a projection rather than five hand-written literals.
 */
export function experience(t: Translation): string {
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
export function education(t: Translation): string {
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

export function certifications(t: Translation): string {
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

export function skills(t: Translation): string {
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

export function hobbies(t: Translation): string {
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
 * The questions a reader actually asks, presented as a message thread on a
 * phone. Questions and answers, not a pitch: the section states facts about
 * the work and the life around it, and stops there.
 *
 * The bubbles are the load-bearing part: they wrap at a plain CSS max-width
 * (fine without JS), and [src/chat.ts](src/chat.ts) then tightens each one to
 * its optimal wrap width with pretext. The bubble text is duplicated into
 * data-text so the enhancement measures exactly the visible text (the .sr-only
 * sender prefix is for screen readers only).
 *
 * The phone around them is what makes the thread read as a thread rather than
 * as two columns of coloured boxes. Its screen is a fixed 19.5:9, so the thread
 * scrolls inside it as it would on the device—which is why `.chat` carries
 * `tabindex="0"`: a scrollable region has to be reachable by keyboard, and the
 * `role="group"` it already had does not make it focusable. The width control is the
 * pretext demo's own (chenglou.me/pretext/bubbles): dragging it re-tightens
 * every bubble live, which is the whole point of measuring instead of
 * guessing. It is `.js`-gated in CSS, since a range input that moves nothing
 * would be a lie without the script.
 */
export function dialogue(t: Translation, lang: Lang): string {
  const rows = t.dialogue.messages.map(
    (m) => `
              <div class="chat__row${m.me ? " chat__row--me" : ""}">
                <div class="msg" data-text="${
      escapeHtml(m.text)
    }"><span class="sr-only">${
      escapeHtml(m.me ? t.dialogue.me : t.dialogue.visitor)
    }: </span>${markChinese(escapeHtml(m.text), lang)}</div>
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

export function contact(t: Translation): string {
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
