import './fonts';
import './styles.css';
import { HTML_LANG, LANGS, type Lang, translations } from './translations';
import { langUrl, renderApp, type Theme } from './render';
import {
  auditSectionTitles,
  debounce,
  fitHeroName,
  fitSectionTitles,
  whenFontsReady,
} from './measure';
import { breakIntoLines } from './linebreak';

const STORAGE_THEME_KEY = 'cv-theme';
const root = document.documentElement;
const app = document.getElementById('app');

let currentLang: Lang = 'en';
let theme: Theme = 'dark';
let isFirstRender = true;

function isLang(value: string | undefined): value is Lang {
  return value !== undefined && (LANGS as readonly string[]).includes(value);
}

/** Language of the current page, from the pre-rendered `<html data-lang>` or the URL. */
function pageLang(): Lang {
  if (isLang(root.dataset.lang)) return root.dataset.lang;
  const path = location.pathname;
  if (/(?:^|\/)zh(?:\.html)?\/?$/.test(path)) return 'zh';
  if (/(?:^|\/)fr(?:\.html)?\/?$/.test(path)) return 'fr';
  return 'en';
}

function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(next: Theme): void {
  theme = next;
  root.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_THEME_KEY, next);
  } catch {
    // storage may be unavailable (private mode) — the class on <html> is enough.
  }
}

/* ------------------------------------------------------------------ *
 * pretext-driven measurement
 * ------------------------------------------------------------------ */

/** Font descriptor for the display type pretext measures (weight 800, -0.03em tracking). */
const HERO_FONT = { weight: 800, letterSpacingEm: -0.03 } as const;

function sectionTitleLabel(el: HTMLElement): string {
  let text = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
  });
  return text.trim();
}

/** Fit the hero name to width, and the section titles to their column. */
function applyMeasuredLayout(): void {
  if (!app) return;

  const nameEl = app.querySelector<HTMLElement>('.hero__name');
  if (nameEl) fitHeroName(nameEl, { ...HERO_FONT, minPx: 32, maxPx: 160 });

  const titleEls = Array.from(app.querySelectorAll<HTMLElement>('.section .section__title'));
  if (titleEls.length > 0) {
    fitSectionTitles(titleEls, {
      ...HERO_FONT,
      columnRem: 26,
      maxPx: 72,
      minPx: 28,
      desktopMinRem: 56,
      label: sectionTitleLabel,
    });
  }
}

function escapeLine(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Re-typeset the About paragraphs with Knuth–Plass optimal line breaking and
 * syllable hyphenation (Latin languages only; Chinese wraps natively). A pure
 * progressive enhancement over the plain, pre-rendered paragraph.
 */
function enhanceAbout(): void {
  if (!app || currentLang === 'zh') return;

  app.querySelectorAll<HTMLParagraphElement>('p.kp').forEach((p) => {
    const text = p.dataset.text ?? p.textContent ?? '';
    if (!text.trim()) return;
    p.dataset.text = text; // keep the source text for re-runs (resize)

    const style = getComputedStyle(p);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const width = p.clientWidth -
      (parseFloat(style.paddingLeft) || 0) -
      (parseFloat(style.paddingRight) || 0);

    // Small safety margin: keep KP lines just inside the box so canvas-vs-DOM
    // rounding never makes the browser wrap a line that justify then can't fill.
    const lines = breakIntoLines(text, font, width - 6, currentLang);
    if (!lines) {
      p.textContent = text;
      return;
    }
    p.innerHTML = lines.map((line) => `<span class="kp-line">${escapeLine(line)}</span>`).join('');
  });
}

/** Dev-only, pretext-powered QA: warn if any section title must shrink to fit in EN/FR/ZH. */
function auditTitles(): void {
  const host = location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return;

  const labelsByLang: Record<string, string[]> = {};
  for (const lang of LANGS) {
    const { nav } = translations[lang];
    labelsByLang[lang] = [nav.about, nav.experience, nav.education, nav.skills, nav.hobbies];
  }

  const tight = auditSectionTitles(labelsByLang, { ...HERO_FONT, columnRem: 26, maxPx: 72 })
    .filter((entry) => !entry.fitsAtMax);

  if (tight.length > 0) {
    console.groupCollapsed(`[measure] ${tight.length} section title(s) shrink below 72px to fit`);
    console.table(tight);
    console.groupEnd();
  } else {
    console.info('[measure] all section titles fit at max size across EN/FR/ZH');
  }
}

/* ------------------------------------------------------------------ *
 * Reveal-on-scroll enhancements
 * ------------------------------------------------------------------ */

function observeSections(): void {
  if (!app) return;

  if (!('IntersectionObserver' in globalThis)) {
    app.querySelectorAll('.animate').forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  app.querySelectorAll('.hero .animate').forEach((el) => el.classList.add('is-revealed'));
  app.querySelectorAll('.animate').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < globalThis.innerHeight && rect.bottom > 0) el.classList.add('is-revealed');
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.querySelectorAll('.animate').forEach((el) => el.classList.add('is-revealed'));
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.05, rootMargin: '0px 0px -24px 0px' },
  );
  app.querySelectorAll('.section, .contact').forEach((section) => observer.observe(section));
}

function animateStats(): void {
  app?.querySelectorAll<HTMLElement>('.stat[data-count]').forEach((stat) => {
    const target = parseFloat(stat.dataset.count ?? '0');
    const valueEl = stat.querySelector('.stat__value');
    if (!valueEl) return;

    const duration = 1200;
    const start = performance.now();
    const isFloat = target % 1 !== 0;

    const frame = (now: number): void => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      valueEl.textContent = isFloat ? current.toFixed(2) : String(Math.round(current));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/* ------------------------------------------------------------------ *
 * Rendering & navigation
 * ------------------------------------------------------------------ */

function bindEvents(): void {
  // Language links: real <a> (work without JS) intercepted for an instant,
  // reload-free switch that keeps the URL shareable via history.pushState.
  app?.querySelectorAll<HTMLAnchorElement>('a[data-lang]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const next = link.dataset.lang;
      if (!isLang(next) || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      if (next === currentLang) return;
      currentLang = next;
      root.lang = HTML_LANG[next];
      root.dataset.lang = next;
      history.pushState({ lang: next }, '', langUrl(next));
      render(true);
    });
  });

  app?.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    applyTheme(theme === 'light' ? 'dark' : 'light');
    render(true);
  });
}

function render(transition: boolean): void {
  if (!app) return;

  const paint = (): void => {
    app.innerHTML = renderApp(currentLang, theme);
    bindEvents();
    requestAnimationFrame(() => {
      app.classList.remove('is-transitioning');
      observeSections();
      animateStats();
      whenFontsReady(() => {
        applyMeasuredLayout();
        enhanceAbout();
      });
    });
  };

  if (transition && !isFirstRender) {
    app.classList.add('is-transitioning');
    setTimeout(paint, 220);
  } else {
    isFirstRender = false;
    paint();
  }
}

function onPopState(): void {
  const next = pageLang();
  if (next === currentLang) return;
  currentLang = next;
  root.lang = HTML_LANG[next];
  root.dataset.lang = next;
  render(true);
}

function init(): void {
  currentLang = pageLang();
  root.lang = HTML_LANG[currentLang];
  root.dataset.lang = currentLang;
  applyTheme(getStoredTheme());

  render(false);

  globalThis.addEventListener('popstate', onPopState);
  globalThis.addEventListener(
    'resize',
    debounce(() => {
      applyMeasuredLayout();
      enhanceAbout();
    }, 150),
    { passive: true },
  );
  whenFontsReady(auditTitles);
}

void init();
