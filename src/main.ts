import { feature } from "bun:bundle";
import { FONT_FACES } from "./fonts.ts";
import "./styles.css";
import {
  DISPLAY_FONT,
  HERO_FIT,
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
import { enhanceChat } from "./chat.ts";

// Mark JS as available only now, when the app code actually runs: `.js .animate`
// hides content for the reveal animations, so flipping the class any earlier
// (e.g. from an inline <head> script) would blank the pre-rendered page for the
// whole duration of the bundle download.
document.documentElement.classList.add("js");

const STORAGE_THEME_KEY = "cv-theme";
const root = document.documentElement;
const app = document.getElementById("app");

let currentLang: Lang = "en";
let theme: Theme = "light";

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

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The OS appearance, which the page follows until the visitor overrides it. */
function systemTheme(): Theme {
  return globalThis.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
}

/** An explicit choice made by the visitor, if there is one. */
function storedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
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

/**
 * `persist` separates the two ways the appearance can change: the visitor
 * flipping the toggle (remembered) versus the page following the OS (not — so
 * a later system change still lands).
 */
function applyTheme(next: Theme, persist: boolean): void {
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
  if (persist) {
    try {
      localStorage.setItem(STORAGE_THEME_KEY, next);
    } catch {
      // storage may be unavailable (private mode) — the attribute on <html> is enough.
    }
  }
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
  if (nameEl) fitHeroName(nameEl, { ...font, ...HERO_FIT });

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
 * Narrowest column worth justifying. Phones sit around 280–390px here, which is
 * a ~40-character measure — tight, but paperbacks justify at that width all the
 * time, and with hyphenation on it holds up (measured: spaces stretch ~2x on a
 * phone against ~1.3x on desktop, no line overflowing its column).
 *
 * This used to be 460, which skipped every phone. The rivers that motivated it
 * were real, but their cause was a missing break opportunity, not the narrow
 * measure: nothing could break `customer-facing` at its own hyphen, so whole
 * paragraphs had no tight layout available (see splitOnHardBreaks in
 * linebreak.ts). Below 280 the paragraph stays plain — there ragged-right
 * really is more legible.
 */
const KP_MIN_WIDTH_PX = 280;

/**
 * Re-typeset the About paragraphs with Knuth–Plass optimal line breaking and
 * syllable hyphenation (Latin languages only; Chinese wraps natively). A pure
 * progressive enhancement over the plain, pre-rendered paragraph.
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

    // Also the undo path: a resize down from a wide column must drop the
    // per-line spans, not leave the last justified layout behind.
    if (width < KP_MIN_WIDTH_PX) {
      p.textContent = text;
      continue;
    }

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
      nav.contact,
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

  const raw = stat.dataset.count ?? "0";
  const target = parseFloat(raw);
  const valueEl = stat.querySelector(".stat__value");
  if (!valueEl) return;

  // Render every frame with the precision the source value was written at, so
  // the counter never invents or drops a decimal (all four stats are integers
  // today; a "3.88" would count up as 3.88, not 4).
  const decimals = raw.split(".")[1]?.length ?? 0;

  if (reducedMotion()) {
    valueEl.textContent = target.toFixed(decimals);
    return;
  }

  const duration = 900;
  // Quantized ease-out: the value climbs in visible ticks instead of a smooth
  // blur of digits.
  const ticks = 10;
  const start = performance.now();
  const frame = (now: number): void => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const stepped = progress >= 1 ? 1 : Math.floor(eased * ticks) / ticks;
    const current = target * stepped;
    valueEl.textContent = current.toFixed(decimals);
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
  app.querySelectorAll(".section").forEach((section) =>
    observer.observe(section)
  );
  revealObserver = observer;
}

/* ------------------------------------------------------------------ *
 * Experience rail tracker
 * ------------------------------------------------------------------ */

/**
 * The accent bubble that rides the experience timeline's rail: at the top of the
 * section it sits on the current role, and it travels down to the earliest one
 * as the reader scrolls the section through the viewport.
 *
 * Pure progressive enhancement — the CSS keeps the bubble hidden and the current
 * role's node filled until we flag the track `is-tracking`, so a no-JS or
 * reduced-motion visitor keeps the fixed highlight. Positions are read live from
 * the first and last node each frame (never cached), so the reveal transforms
 * and the 52rem grid switch need no invalidation; the reads are rAF-throttled
 * behind a passive scroll listener, so a scroll costs one batch of rects and a
 * composited move.
 */

/** Fraction of the viewport height used as the tracker's "you are here" line. */
const TRACKER_FOCUS = 0.5;

let trackerDot: HTMLElement | null = null;
let trackerFirst: HTMLElement | null = null;
let trackerLast: HTMLElement | null = null;
let trackerRAF = 0;

function positionTracker(): void {
  trackerRAF = 0;
  const dot = trackerDot, first = trackerFirst, last = trackerLast;
  const wrap = dot?.parentElement;
  if (!dot || !first || !last || !wrap) return;

  const wrapRect = wrap.getBoundingClientRect();
  const a = first.getBoundingClientRect();
  const b = last.getBoundingClientRect();

  const firstY = a.top - wrapRect.top + a.height / 2;
  const span = (b.top - wrapRect.top + b.height / 2) - firstY;
  const focus = globalThis.innerHeight * TRACKER_FOCUS;
  const progress = span > 0
    ? Math.min(Math.max((focus - (wrapRect.top + firstY)) / span, 0), 1)
    : 0;

  // Rail centre from the track's left — correct in both the narrow (rail-first)
  // and wide (date-then-rail) grids without hard-coding either column.
  dot.style.setProperty(
    "--tracker-x",
    `${a.left - wrapRect.left + a.width / 2}px`,
  );
  dot.style.transform = `translate(-50%, -50%) translateY(${
    firstY + progress * span
  }px)`;
}

function onTrackerScroll(): void {
  if (trackerRAF) return;
  trackerRAF = requestAnimationFrame(positionTracker);
}

/** Wire the experience bubble to scroll, or leave the static node under reduced motion. */
function setupTracker(): void {
  trackerDot = trackerFirst = trackerLast = null;
  if (reducedMotion()) return;

  const wrap = app?.querySelector<HTMLElement>(".timeline-track");
  const dot = wrap?.querySelector<HTMLElement>(".timeline__tracker");
  const nodes = wrap?.querySelectorAll<HTMLElement>(".timeline__node");
  if (!wrap || !dot || !nodes || nodes.length < 2) return;

  trackerDot = dot;
  trackerFirst = nodes[0] ?? null;
  trackerLast = nodes[nodes.length - 1] ?? null;
  wrap.classList.add("is-tracking");
  positionTracker();
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
      // Let the browser handle every modified click itself — new tab/window
      // (meta/ctrl/shift) and download (alt) all mean "not an in-page switch".
      if (
        !isLang(next) ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      ) {
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
    applyTheme(theme === "light" ? "dark" : "light", true);
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

function afterPaint(): void {
  observeSections();
  whenFontsReady(() => {
    applyMeasuredLayout();
    enhanceChat();
    void enhanceAboutKp();
    setupTracker();
  });
}

/**
 * The armed fade-out of a transition that hasn't painted yet. Two switches
 * inside PAGE_SWAP_MS would otherwise stack two paints, and the first one —
 * rendering an already-stale language — would land after the second.
 */
let pendingPaint: ReturnType<typeof setTimeout> | null = null;

function render(transition: boolean): void {
  if (!app) return;

  if (pendingPaint !== null) {
    clearTimeout(pendingPaint);
    pendingPaint = null;
  }

  const paint = (): void => {
    pendingPaint = null;
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
    pendingPaint = setTimeout(paint, PAGE_SWAP_MS);
  } else {
    paint();
  }
}

/**
 * First load of a pre-rendered page: the markup is already exactly what
 * `renderApp` would produce, so don't rebuild it — just bind events, sync the
 * theme toggle (pre-rendered as light) and start the enhancements.
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
  const chosen = storedTheme();
  applyTheme(chosen ?? systemTheme(), false);

  const prerendered = app?.querySelector<HTMLElement>(".page");
  if (prerendered && prerendered.dataset.lang === currentLang) {
    hydrate();
  } else {
    render(false); // dev shell (loader) or stale markup
  }

  // Follow the OS appearance for as long as the visitor hasn't overridden it.
  globalThis.matchMedia?.(DARK_QUERY).addEventListener("change", (event) => {
    if (storedTheme()) return;
    applyTheme(event.matches ? "dark" : "light", false);
  });

  globalThis.addEventListener("popstate", onPopState);
  // One passive scroll listener for the life of the page: it drives the
  // experience bubble, reading the current tracker refs `setupTracker` refreshes
  // on every render, and no-ops entirely when tracking is off (reduced motion).
  globalThis.addEventListener("scroll", onTrackerScroll, { passive: true });
  globalThis.addEventListener(
    "resize",
    debounce(() => {
      applyMeasuredLayout();
      enhanceChat();
      void enhanceAboutKp();
      positionTracker();
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
