/*
 * Pure, side-effect-free rendering. Every function takes data and returns an
 * HTML string — no DOM access — so the exact same code runs in two places:
 *   - the client ([src/main.ts](src/main.ts)) to (re)render on language/theme change,
 *   - the static build ([scripts/build.ts](scripts/build.ts)) to pre-render each
 *     language page at build time (SEO, link previews, no-JS content).
 */

import { translations, type Lang, type Translation } from './translations';

export type Theme = 'light' | 'dark';

const EMAIL = 'jorge.paulapinheiro@gmail.com';
const SPOTIFY = 'https://open.spotify.com/intl-fr/artist/0CKa7wVI7tiJaFdIBNHw8T';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Relative URL to a language's page. All three pages are siblings at the site
 * root (`index.html`, `fr.html`, `zh.html`), so the link is the same from any
 * page and works under any deploy path — no base tag, no absolute origin.
 */
export function langUrl(lang: Lang): string {
  return lang === 'en' ? './' : `${lang}.html`;
}

function controls(t: Translation, lang: Lang, theme: Theme): string {
  const isLight = theme === 'light';
  const languages = [
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
    { code: 'zh', label: 'ZH' },
  ] as const;

  return `
    <div class="controls" role="toolbar" aria-label="${escapeHtml(t.ui.primaryNav)}">
      ${languages
        .map(
          (l) => `
        <a href="${langUrl(l.code)}" data-lang="${l.code}"${lang === l.code ? ' aria-current="page"' : ''} aria-label="${escapeHtml(t.ui.languageNav)} ${l.code}">
          ${l.label}
        </a>`,
        )
        .join('')}
      <button type="button" class="controls__theme" data-theme-toggle aria-label="${escapeHtml(isLight ? t.ui.theme.dark : t.ui.theme.light)}">
        ${isLight ? '☾' : '☀'}
      </button>
    </div>
  `;
}

function hero(t: Translation): string {
  return `
    <section class="hero" id="top" aria-label="Introduction">
      <a class="skip-link" href="#about">${escapeHtml(t.ui.skipLink)}</a>
      <div class="hero__eyebrow animate">${escapeHtml(t.hero.greeting)}</div>
      <h1 class="hero__name">
        <span class="hero__name-line animate animate--delayed-1">JORGE</span>
        <span class="hero__name-line animate animate--delayed-2">PAULA PINHEIRO</span>
      </h1>
      <p class="hero__title animate animate--delayed-3">
        ${escapeHtml(t.hero.title)}
      </p>
      <p class="hero__location animate animate--delayed-4">${escapeHtml(t.hero.location)}</p>
      <div class="hero__actions animate animate--delayed-5">
        <a class="button" href="mailto:${EMAIL}">${escapeHtml(t.hero.ctaPrimary)}</a>
        <a class="button button--ghost" href="#experience">${escapeHtml(t.hero.ctaSecondary)}</a>
      </div>
    </section>
  `;
}

function sectionTitle(t: Translation, id: keyof Translation['nav'], index: number): string {
  const label = `0${index + 1}`;
  return `<h2 class="section__title animate" id="${id}"><span>${label}</span>${escapeHtml(t.nav[id])}</h2>`;
}

function about(t: Translation): string {
  return `
    <section class="section" aria-labelledby="about">
      <div>${sectionTitle(t, 'about', 0)}</div>
      <div class="section__body animate">
        <p>${escapeHtml(t.about.p1)}</p>
        <p>${escapeHtml(t.about.p2)}</p>
        <p>${escapeHtml(t.about.p3)}</p>
        <div class="stats animate">
          <div class="stat" data-count="8">
            <div class="stat__label">${escapeHtml(t.about.stats.years)}</div>
            <div class="stat__value">8</div>
          </div>
          <div class="stat" data-count="5.66">
            <div class="stat__label">${escapeHtml(t.about.stats.gpa)}</div>
            <div class="stat__value">5.66</div>
          </div>
          <div class="stat" data-count="4">
            <div class="stat__label">${escapeHtml(t.about.stats.languages)}</div>
            <div class="stat__value">4</div>
          </div>
          <div class="stat" data-count="152">
            <div class="stat__label">${escapeHtml(t.about.stats.ects)}</div>
            <div class="stat__value">152</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function experience(t: Translation): string {
  return `
    <section class="section" aria-labelledby="experience">
      <div>${sectionTitle(t, 'experience', 1)}</div>
      <div class="section__body animate">
        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.experience.chuv.company)}</h3>
            <span class="card__meta">${escapeHtml(t.experience.chuv.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(t.experience.chuv.title)}</p>
          <ul class="card__list">
            ${t.experience.chuv.items.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
          </ul>
        </article>

        <h3 class="card__subtitle" style="margin-top: var(--space-lg)">${escapeHtml(t.experience.studentJobsTitle)}</h3>

        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.experience.galexis.company)}</h3>
            <span class="card__meta">${escapeHtml(t.experience.galexis.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(t.experience.galexis.title)}</p>
          <p>${escapeHtml(t.experience.galexis.desc)}</p>
        </article>

        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.experience.uber.company)}</h3>
            <span class="card__meta">${escapeHtml(t.experience.uber.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(t.experience.uber.title)}</p>
          <p>${escapeHtml(t.experience.uber.desc)}</p>
        </article>

        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.experience.gfk.company)}</h3>
            <span class="card__meta">${escapeHtml(t.experience.gfk.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(t.experience.gfk.title)}</p>
          <p>${escapeHtml(t.experience.gfk.desc)}</p>
        </article>
      </div>
    </section>
  `;
}

function education(t: Translation): string {
  return `
    <section class="section" aria-labelledby="education">
      <div>${sectionTitle(t, 'education', 2)}</div>
      <div class="section__body animate">
        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.education.bachelor.title)}</h3>
            <span class="card__meta">${escapeHtml(t.education.bachelor.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(t.education.bachelor.subtitle)}</p>
          <ul class="card__list">
            ${t.education.bachelor.courses.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}
          </ul>
          <div style="margin-top: var(--space-md)">
            <p><strong>${escapeHtml(t.education.bachelor.thesisTitle)}:</strong> ${escapeHtml(t.education.bachelor.thesis)}</p>
            <p>${escapeHtml(t.education.bachelor.thesisSubject)}</p>
          </div>
          <div class="tags" style="margin-top: var(--space-md)">
            <span class="tag">${escapeHtml(t.education.bachelor.methodology)}: ${escapeHtml(t.education.bachelor.methodologyValue)}</span>
            <span class="tag">${escapeHtml(t.education.bachelor.dataSources)}: ${escapeHtml(t.education.bachelor.dataSourcesValue)}</span>
            <span class="tag">${escapeHtml(t.education.bachelor.tools)}: ${escapeHtml(t.education.bachelor.toolsValue)}</span>
            <span class="tag">${escapeHtml(t.education.bachelor.focus)}: ${escapeHtml(t.education.bachelor.focusValue)}</span>
          </div>
        </article>

        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.education.china.title)}</h3>
            <span class="card__meta">${escapeHtml(t.education.china.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(t.education.china.subtitle)}</p>
          <ul class="card__list">
            <li>${escapeHtml(t.education.china.csc)}</li>
            <li>${escapeHtml(t.education.china.intensive)}</li>
            <li>${escapeHtml(t.education.china.gpa)} ${escapeHtml(t.education.china.gpaDesc)}</li>
            <li>${escapeHtml(t.education.china.immersion)}</li>
            <li>${escapeHtml(t.education.china.adaptability)}</li>
          </ul>
        </article>

        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.education.cfc.title)}</h3>
            <span class="card__meta">${escapeHtml(t.education.cfc.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(t.education.cfc.subtitle)}</p>
          <p>${escapeHtml(t.education.cfc.desc)}</p>
        </article>

        <article class="card">
          <div class="card__header">
            <h3 class="card__title">${escapeHtml(t.education.epfl.title)}</h3>
            <span class="card__meta">${escapeHtml(t.education.epfl.date)}</span>
          </div>
          <p class="card__subtitle">${escapeHtml(t.education.epfl.subtitle)}</p>
          <p>${escapeHtml(t.education.epfl.desc)}</p>
        </article>
      </div>
    </section>
  `;
}

function skills(t: Translation): string {
  const groups = [
    t.skills.data,
    t.skills.econometrics,
    t.skills.it,
    t.skills.finance,
    t.skills.economics,
    t.skills.accounting,
    t.skills.programming,
    t.skills.soft,
  ];
  return `
    <section class="section" aria-labelledby="skills">
      <div>${sectionTitle(t, 'skills', 3)}</div>
      <div class="section__body animate">
        ${groups
          .map(
            (group) => `
          <div class="card">
            <h3 class="card__subtitle" style="margin-bottom: var(--space-xs)">${escapeHtml(group.title)}</h3>
            <div class="tags">
              ${group.tags.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}
            </div>
          </div>`,
          )
          .join('')}
      </div>
    </section>
  `;
}

function hobbies(t: Translation): string {
  const items = [
    { ...t.hobbies.music, hasLink: true },
    t.hobbies.gaming,
    t.hobbies.travel,
    t.hobbies.cycling,
    t.hobbies.language,
  ];
  return `
    <section class="section" aria-labelledby="hobbies">
      <div>${sectionTitle(t, 'hobbies', 4)}</div>
      <div class="section__body animate">
        ${items
          .map(
            (item) => `
          <article class="card">
            <h3 class="card__title">${escapeHtml(item.title)}</h3>
            <p style="color: var(--fg-muted)">${escapeHtml(item.desc)}</p>
            ${'hasLink' in item ? `<a class="contact__link" href="${SPOTIFY}" target="_blank" rel="noopener" style="font-size: 1rem; margin-top: var(--space-xs); display: inline-block">${escapeHtml(item.link)} ↗</a>` : ''}
          </article>`,
          )
          .join('')}
      </div>
    </section>
  `;
}

function contact(t: Translation): string {
  return `
    <section class="contact" aria-labelledby="contact">
      <h2 class="section__title animate" id="contact" style="margin-bottom: var(--space-lg)"><span>06</span>${escapeHtml(t.nav.contact)}</h2>
      <p class="animate" style="color: var(--fg-muted); margin-bottom: var(--space-md); max-width: 50rem">${escapeHtml(t.contact.intro)}</p>
      <div style="display: flex; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg)">
        <div>
          <p style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.1em">${escapeHtml(t.contact.emailLabel)}</p>
          <a class="contact__link" href="mailto:${EMAIL}">${EMAIL}</a>
        </div>
        <div>
          <p style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.1em">${escapeHtml(t.contact.locationLabel)}</p>
          <p style="font-size: 1.5rem; font-weight: 700">${escapeHtml(t.hero.location)}</p>
        </div>
      </div>
    </section>
    <footer class="footer">
      <p>${escapeHtml(t.contact.footer)}</p>
    </footer>
  `;
}

/** The full page markup for one language and theme. */
export function renderApp(lang: Lang, theme: Theme): string {
  const t = translations[lang];
  return `
    <div class="page" data-lang="${lang}" data-theme="${theme}">
      ${controls(t, lang, theme)}
      ${hero(t)}
      ${about(t)}
      ${experience(t)}
      ${education(t)}
      ${skills(t)}
      ${hobbies(t)}
      ${contact(t)}
    </div>
  `;
}
