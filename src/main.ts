import { feature } from "bun:bundle";
import { FONT_FACES } from "./fonts.ts";
import "./styles.css";
import {
  DISPLAY_FONT,
  PAGE_SWAP_MS,
  THEME_COLOR,
  TITLE_FIT,
} from "./config.ts";
import {
  HTML_LANG,
  isLang,
  type Lang,
  LANGS,
  PROFILE,
  translations,
} from "./translations.ts";
import { langUrl, pageTitle, renderApp, type Theme } from "./render.ts";
import { escapeHtml, reducedMotion } from "./dom.ts";
import {
  auditSectionTitles,
  debounce,
  fitHeroName,
  fitSectionTitles,
  whenFontsReady,
} from "./measure.ts";
import { breakIntoLines } from "./linebreak.ts";
import { enhanceAboutOrbs } from "./orbs.ts";
import { enhanceChat } from "./chat.ts";
import { initDither, setDitherIntensity, setDitherTheme } from "./dither.ts";
import { initPanels } from "./panels.ts";

// Mark JS as available only now, when the app code actually runs: `.js .animate`
// hides content for the reveal animations, so flipping the class any earlier
// (e.g. from an inline <head> script) would blank the pre-rendered page for the
// whole duration of the bundle download.
document.documentElement.classList.add("js");

const STORAGE_THEME_KEY = "cv-theme";
const root = document.documentElement;
const app = document.getElementById("app");

let currentLang: Lang = "en";
let theme: Theme = "dark";

/** Language of the current page, from the pre-rendered `<html data-lang>` or the URL. */
function pageLang(): Lang {
  if (isLang(root.dataset.lang)) return root.dataset.lang;
  const path = location.pathname;
  // Longest slug first so `zh-hant.html` is never claimed by the shorter `zh`.
  const bySpecificity = [...LANGS].sort((a, b) => b.length - a.length);
  for (const lang of bySpecificity) {
    if (new RegExp(`(?:^|/)${lang}(?:\\.html)?/?$`).test(path)) return lang;
  }
  return "en";
}

function setLang(next: Lang): void {
  currentLang = next;
  root.lang = HTML_LANG[next];
  root.dataset.lang = next;
}

function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_THEME_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

/** Keep the toggle button's icon and label in sync (it is not re-rendered on toggle). */
function syncThemeToggle(): void {
  const button = app?.querySelector<HTMLElement>("[data-theme-toggle]");
  if (!button) return;
  const t = translations[currentLang];
  const isLight = theme === "light";
  button.textContent = isLight ? "☾" : "☀";
  button.setAttribute(
    "aria-label",
    isLight ? t.ui.theme.dark : t.ui.theme.light,
  );
}

function applyTheme(next: Theme): void {
  theme = next;
  root.dataset.theme = next;
  // The CSS palette (`--bg`) is the source of truth for the browser-chrome
  // color; the constant only covers a not-yet-applied stylesheet.
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim() ||
    THEME_COLOR[next];
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    bg,
  );
  try {
    localStorage.setItem(STORAGE_THEME_KEY, next);
  } catch {
    // storage may be unavailable (private mode) — the attribute on <html> is enough.
  }
  setDitherTheme(next);
  syncThemeToggle();
}

/** Tab title and meta description follow the current language (the SSG sets them per page). */
function syncDocumentMeta(): void {
  const t = translations[currentLang];
  document.title = pageTitle(t);
  document.querySelector('meta[name="description"]')?.setAttribute(
    "content",
    t.meta.description,
  );
}

/* ------------------------------------------------------------------ *
 * pretext-driven measurement
 * ------------------------------------------------------------------ */

/**
 * The page's real font stack, so CJK titles are measured with the family they
 * render in (Noto Sans SC on zh, Noto Sans TC on zh-hant).
 */
function pageFontFamily(): string {
  return getComputedStyle(document.body).fontFamily;
}

function sectionTitleLabel(el: HTMLElement): string {
  let text = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
  });
  return text.trim();
}

/** Fit the hero name to width, and the section titles to their column. */
function applyMeasuredLayout(): void {
  if (!app) return;
  const font = { ...DISPLAY_FONT, family: pageFontFamily() };

  const nameEl = app.querySelector<HTMLElement>(".hero__name");
  if (nameEl) fitHeroName(nameEl, font); // minPx/maxPx: the measure.ts defaults

  const titleEls = Array.from(
    app.querySelectorAll<HTMLElement>(".section .section__title"),
  );
  if (titleEls.length > 0) {
    fitSectionTitles(titleEls, {
      ...font,
      ...TITLE_FIT,
      label: sectionTitleLabel,
    });
  }
}

/**
 * Re-typeset the About paragraphs with Knuth–Plass optimal line breaking and
 * syllable hyphenation (Latin languages only; Chinese wraps natively). A pure
 * progressive enhancement over the plain, pre-rendered paragraph — and itself
 * the fallback when the orb layout (enhanceAboutOrbs) can't run.
 */
async function enhanceAboutKp(): Promise<void> {
  if (!app || currentLang.startsWith("zh")) return;
  const lang = currentLang;

  for (const p of app.querySelectorAll<HTMLParagraphElement>("p.kp")) {
    const text = p.dataset.text ?? p.textContent ?? "";
    if (!text.trim()) continue;
    p.dataset.text = text; // keep the source text for re-runs (resize)

    const style = getComputedStyle(p);
    const font =
      `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const width = p.clientWidth -
      (parseFloat(style.paddingLeft) || 0) -
      (parseFloat(style.paddingRight) || 0);

    // Small safety margin: keep KP lines just inside the box so canvas-vs-DOM
    // rounding never makes the browser wrap a line that justify then can't fill.
    const lines = await breakIntoLines(text, font, width - 6, lang);
    // The DOM may have been replaced while the patterns loaded (language switch).
    if (lang !== currentLang || !p.isConnected) return;
    if (!lines) {
      p.textContent = text;
      continue;
    }
    p.innerHTML = lines.map((line) =>
      `<span class="kp-line">${escapeHtml(line)}</span>`
    ).join("");
  }
}

/** Orb-aware flow layout when possible, Knuth–Plass justification otherwise. */
async function enhanceAbout(): Promise<void> {
  if (await enhanceAboutOrbs(currentLang)) return;
  await enhanceAboutKp();
}

/** Dev-only, pretext-powered QA: warn if any section title must shrink to fit in any language. */
function auditTitles(): void {
  const host = location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return;

  const labelsByLang: Record<string, string[]> = {};
  for (const lang of LANGS) {
    const { nav } = translations[lang];
    labelsByLang[lang] = [
      nav.about,
      nav.experience,
      nav.education,
      nav.certifications,
      nav.skills,
      nav.hobbies,
      nav.dialogue,
    ];
  }

  // Both CJK families in one stack: each language's labels resolve to the
  // family they would render with, regardless of the page we audit from.
  const family = [
    ...FONT_FACES.map((face) => `'${face.family}'`),
    "system-ui",
    "sans-serif",
  ].join(", ");
  const tight = auditSectionTitles(labelsByLang, {
    ...DISPLAY_FONT,
    family,
    columnRem: TITLE_FIT.columnRem,
    maxPx: TITLE_FIT.maxPx,
  })
    .filter((entry) => !entry.fitsAtMax);

  if (tight.length > 0) {
    console.groupCollapsed(
      `[measure] ${tight.length} section title(s) shrink below ${TITLE_FIT.maxPx}px to fit`,
    );
    console.table(tight);
    console.groupEnd();
  } else {
    console.info(
      "[measure] all section titles fit at max size across all languages",
    );
  }
}

/* ------------------------------------------------------------------ *
 * Reveal-on-scroll enhancements
 * ------------------------------------------------------------------ */

let revealObserver: IntersectionObserver | null = null;

function inViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.top < globalThis.innerHeight && rect.bottom > 0;
}

/** Count one stat up to its value — once, and instantly under reduced motion. */
function startStat(stat: HTMLElement): void {
  if (stat.dataset.animated) return;
  stat.dataset.animated = "true";

  const target = parseFloat(stat.dataset.count ?? "0");
  const valueEl = stat.querySelector(".stat__value");
  if (!valueEl) return;

  const isFloat = target % 1 !== 0;
  if (reducedMotion()) {
    valueEl.textContent = isFloat ? target.toFixed(2) : String(target);
    return;
  }

  const duration = 900;
  // Quantized ease-out: the value climbs in visible ticks (dither-style
  // discreteness) instead of a smooth blur of digits.
  const ticks = 10;
  const start = performance.now();
  const frame = (now: number): void => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const stepped = progress >= 1 ? 1 : Math.floor(eased * ticks) / ticks;
    const current = target * stepped;
    valueEl.textContent = isFloat
      ? current.toFixed(2)
      : String(Math.round(current));
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Reveal a container's animated elements and start any stat counters it holds. */
function reveal(container: Element): void {
  if (container.classList.contains("animate")) {
    container.classList.add("is-revealed");
  }
  container.querySelectorAll(".animate").forEach((el) =>
    el.classList.add("is-revealed")
  );
  container.querySelectorAll<HTMLElement>(".stat[data-count]").forEach(
    startStat,
  );
}

function observeSections(): void {
  if (!app) return;
  revealObserver?.disconnect();
  revealObserver = null;

  if (!("IntersectionObserver" in globalThis)) {
    reveal(app);
    return;
  }

  // The hero and anything already in the viewport shows immediately; stats in
  // view start counting now — the rest waits for its section to scroll in.
  app.querySelectorAll(".hero .animate").forEach((el) =>
    el.classList.add("is-revealed")
  );
  app.querySelectorAll(".animate").forEach((el) => {
    if (inViewport(el)) el.classList.add("is-revealed");
  });
  app.querySelectorAll<HTMLElement>(".stat[data-count]").forEach((stat) => {
    if (inViewport(stat)) startStat(stat);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.05, rootMargin: "0px 0px -24px 0px" },
  );
  app.querySelectorAll(".section, .contact").forEach((section) =>
    observer.observe(section)
  );
  revealObserver = observer;
}

/* ------------------------------------------------------------------ *
 * Rendering & navigation
 * ------------------------------------------------------------------ */

function bindEvents(): void {
  // Language links: real <a> (work without JS) intercepted for an instant,
  // reload-free switch that keeps the URL shareable via history.pushState.
  app?.querySelectorAll<HTMLAnchorElement>("a[data-lang]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const next = link.dataset.lang;
      if (!isLang(next) || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      event.preventDefault();
      if (next === currentLang) return;
      setLang(next);
      history.pushState({ lang: next }, "", langUrl(next));
      render(true);
    });
  });

  // Theme is pure CSS (`data-theme` on <html>): no re-render, just the icon sync.
  app?.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    applyTheme(theme === "light" ? "dark" : "light");
  });

  // Contact closer: copy the WeChat id, flash the copied label on the button.
  const copyBtn = app?.querySelector<HTMLButtonElement>("[data-copy-wechat]");
  copyBtn?.addEventListener("click", () => {
    navigator.clipboard?.writeText(PROFILE.wechat).then(() => {
      const label = copyBtn.textContent;
      copyBtn.textContent = copyBtn.dataset.copiedLabel ?? label;
      copyBtn.classList.add("is-copied");
      setTimeout(() => {
        copyBtn.textContent = label;
        copyBtn.classList.remove("is-copied");
      }, 1600);
    }).catch(() => {
      // Clipboard denied — the id is printed right above the button anyway.
    });
  });
}

// Cloud drama per panel (keyed by the panel's hash id, kimi-style: theatrical
// bookends, calm background behind dense content). Anything unlisted reads.
const PANEL_INTENSITY: Record<string, number> = {
  top: 1,
  about: 0.5,
  stats: 0.65,
  contact: 1,
};

function activatePanel(panel: HTMLElement): void {
  reveal(panel);
  const id = panel.id || panel.querySelector("[id]")?.id || "";
  setDitherIntensity(PANEL_INTENSITY[id] ?? 0.35);
}

function afterPaint(): void {
  // Deck mode reveals panels on activation; native mode reveals on scroll.
  if (!initPanels({ onActivate: activatePanel })) observeSections();
  whenFontsReady(() => {
    applyMeasuredLayout();
    enhanceChat();
    void enhanceAbout();
  });
}

function render(transition: boolean): void {
  if (!app) return;

  const paint = (): void => {
    app.innerHTML = renderApp(currentLang, theme);
    syncDocumentMeta();
    bindEvents();
    requestAnimationFrame(() => {
      app.classList.remove("is-transitioning");
      afterPaint();
    });
  };

  if (transition) {
    app.classList.add("is-transitioning");
    setTimeout(paint, PAGE_SWAP_MS);
  } else {
    paint();
  }
}

/**
 * First load of a pre-rendered page: the markup is already exactly what
 * `renderApp` would produce, so don't rebuild it — just bind events, sync the
 * theme toggle (pre-rendered as dark) and start the enhancements.
 */
function hydrate(): void {
  bindEvents();
  syncThemeToggle();
  afterPaint();
}

function onPopState(): void {
  const next = pageLang();
  if (next === currentLang) return;
  setLang(next);
  render(true);
}

function init(): void {
  setLang(pageLang());
  applyTheme(getStoredTheme());

  const prerendered = app?.querySelector<HTMLElement>(".page");
  if (prerendered && prerendered.dataset.lang === currentLang) {
    hydrate();
  } else {
    render(false); // dev shell (loader) or stale markup
  }

  // The dithered background attaches to <body> and survives re-renders.
  void initDither();

  globalThis.addEventListener("popstate", onPopState);
  globalThis.addEventListener(
    "resize",
    debounce(() => {
      applyMeasuredLayout();
      enhanceChat();
      void enhanceAbout();
    }, 150),
    { passive: true },
  );
  // Dev-only diagnostic. The production build passes `features: ["PROD"]`, so
  // this branch compiles to `if (false)` and the whole audit (auditTitles +
  // auditSectionTitles) is tree-shaken out of the bundle; the dev server never
  // sets feature flags, so it always runs there.
  if (!feature("PROD")) {
    whenFontsReady(auditTitles);
  }
}

init();
