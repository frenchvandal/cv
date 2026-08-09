import { feature } from "bun:bundle";
import { FONT_FACES } from "./fonts.ts";
import "./styles.css";
import {
  CHAT_WIDTH,
  DISPLAY_FONT,
  HERO_FIT,
  NAV_FIT,
  NAV_FONT,
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
import {
  langFromPath,
  langUrl,
  NAV_LINKS,
  pageLang,
  renderApp,
  STORAGE_LANG_KEY,
  type Theme,
} from "./render.ts";
import { headMeta, pageMeta, pageUrl } from "./meta.ts";
import { reducedMotion } from "./dom.ts";
import {
  auditNavLinks,
  auditSectionTitles,
  debounce,
  fitHeroName,
  fitNavLinks,
  fitSectionTitles,
  fontSpecFrom,
  whenFontsReady,
} from "./measure.ts";
import { breakIntoLines, pretextMeasure } from "./linebreak.ts";
import { renderLines, runsFrom } from "./richtext.ts";
import { enhanceChat } from "./chat.ts";

// Mark JS as available only now, when the app code actually runs: `.js .animate`
// hides content for the reveal animations, so flipping the class any earlier
// (e.g., from an inline <head> script) would blank the pre-rendered page for the
// whole duration of the bundle download.
document.documentElement.classList.add("js");

const STORAGE_THEME_KEY = "cv-theme";
const root = document.documentElement;
const app = document.getElementById("app");

let currentLang: Lang = "en";
let theme: Theme = "light";

function setLang(next: Lang): void {
  currentLang = next;
  root.lang = HTML_LANG[next];
  root.dataset.lang = next;
}

/**
 * Remember a language the visitor picked by hand. The root page's negotiation
 * script (see `languageNegotiationScript` in [src/render.ts](src/render.ts))
 * reads this and lets it outrank the browser's own list, so the switcher always
 * has the last word.
 */
function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_LANG_KEY, lang);
  } catch {
    // Storage may be unavailable (private mode)—the switch still works, it
    // just won't survive the visit.
  }
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
 * flipping the toggle (remembered) versus the page following the OS (not—so
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
      // storage may be unavailable (private mode)—the attribute on <html> is enough.
    }
  }
  syncThemeToggle();
}

/**
 * The whole <head> follows the current language, not just the tab title: the
 * switch moves the URL to the new page with `history.pushState`, so a canonical,
 * `og:url` or JSON-LD still naming English would describe a page the address bar
 * no longer points at. The SSG bakes these same values in per page
 * ([scripts/build.ts](scripts/build.ts)); both read them from
 * [src/meta.ts](src/meta.ts), so the two heads can't diverge.
 *
 * A selector that matches nothing is skipped: the image tags only exist in a
 * SITE_URL build, and the dev shell has no canonical at all.
 */
function syncDocumentMeta(): void {
  const meta = pageMeta(currentLang, pageUrl(currentLang, location.href));
  for (const { selector, attr, value } of headMeta(meta)) {
    const el = document.querySelector(selector);
    if (!el) continue;
    if (attr === "text") el.textContent = value;
    else el.setAttribute(attr, value);
  }
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

/**
 * Fit the hero name to width, the section titles to their column, and the nav
 * shortcuts to what the bar leaves them.
 */
function applyMeasuredLayout(): void {
  if (!app) return;
  const family = pageFontFamily();
  const font = { ...DISPLAY_FONT, family };

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

  const linksEl = app.querySelector<HTMLElement>(".nav__links");
  if (linksEl) fitNavLinks(linksEl, { ...NAV_FONT, family, ...NAV_FIT });
}

/**
 * Screen width of the Dialogue phone once the reader has moved its slider, kept
 * across a language switch: the re-render brings the markup back at its default
 * width, and a width someone chose should survive the swap.
 */
let chatWidthPx: number | null = null;

/** Write a width to the phone and its readout. Does not re-measure. */
function applyChatWidth(px: number): void {
  const clamped = Math.min(CHAT_WIDTH.max, Math.max(CHAT_WIDTH.min, px));
  chatWidthPx = clamped;
  app?.querySelector<HTMLElement>(".phone")?.style.setProperty(
    "--phone-w",
    `${clamped}px`,
  );
  const readout = app?.querySelector<HTMLElement>("[data-chat-width-value]");
  if (readout) readout.textContent = `${clamped} px`;
}

/** The slider's handler: a new width, then the bubbles re-tightened to it. */
function setChatWidth(px: number): void {
  applyChatWidth(px);
  enhanceChat();
}

/** Put a previously chosen width back on freshly rendered markup. */
function restoreChatWidth(): void {
  if (chatWidthPx === null) return;
  const range = app?.querySelector<HTMLInputElement>("[data-chat-width]");
  if (range) range.value = String(chatWidthPx);
  applyChatWidth(chatWidthPx);
}

/**
 * Narrowest column worth justifying. Phones sit around 280–390px here, which is
 * a ~40-character measure—tight, but paperbacks justify at that width all the
 * time, and with hyphenation on it holds up (measured: spaces stretch ~2x on a
 * phone against ~1.3x on desktop, no line overflowing its column).
 *
 * This used to be 460, which skipped every phone. The rivers that motivated it
 * were real, but their cause was a missing break opportunity, not the narrow
 * measure: nothing could break `customer-facing` at its own hyphen, so whole
 * paragraphs had no tight layout available (see splitOnHardBreaks in
 * linebreak.ts). Below 280 the paragraph stays plain—there ragged-right
 * really is more legible.
 */
const KP_MIN_WIDTH_PX = 280;

/**
 * Re-typeset the prose paragraphs with Knuth–Plass optimal line breaking and
 * syllable hyphenation, markup intact (Latin languages only; Chinese wraps
 * natively). A pure progressive enhancement over the plain, pre-rendered
 * paragraph.
 *
 * The About paragraphs are the degenerate case of this path—one run, no
 * markup; an article's paragraphs carry em/strong/code/a, each measured in
 * its own font and rebuilt with its inline chain reopened per line. Three
 * paragraphs in About, forty in an article: composing all of them at load
 * would block interaction and shift the page under the reader, so each
 * paragraph is composed by an IntersectionObserver shortly BEFORE it enters
 * the field (one screen of margin), and a resize recomposes only the ones
 * already composed.
 */
async function justifyParagraph(p: HTMLParagraphElement): Promise<void> {
  const lang = currentLang;
  // The source markup, kept for re-runs (resize): every pass starts from it,
  // never from the line spans of a previous pass—which is also the undo path
  // when the column gets too narrow for justification.
  p.dataset.rich ??= p.innerHTML;
  p.innerHTML = p.dataset.rich;

  const style = getComputedStyle(p);
  const { letterSpacing } = fontSpecFrom(style);
  const width = p.clientWidth -
    (parseFloat(style.paddingLeft) || 0) -
    (parseFloat(style.paddingRight) || 0);
  if (width < KP_MIN_WIDTH_PX) return;

  const runs = runsFrom(p);
  // Small safety margin: keep KP lines just inside the box so canvas-vs-DOM
  // rounding never makes the browser wrap a line that justify then can't fill.
  const lines = await breakIntoLines(
    runs,
    width - 6,
    lang,
    pretextMeasure(letterSpacing),
  );
  // The DOM may have been replaced while the patterns loaded (language switch).
  if (lang !== currentLang || !p.isConnected) return;
  if (!lines) return;
  renderLines(p, lines, runs);
}

/** The paragraphs this path typesets: About's, and an article's body. */
function justifiedParagraphs(): HTMLParagraphElement[] {
  if (!app) return [];
  return [
    ...app.querySelectorAll<HTMLParagraphElement>("p.kp"),
    ...app.querySelectorAll<HTMLParagraphElement>(".post__body > p"),
  ];
}

let kpObserver: IntersectionObserver | null = null;

function enhanceJustified(): void {
  if (!app || currentLang.startsWith("zh")) return;
  kpObserver?.disconnect();
  const paragraphs = justifiedParagraphs();
  if (paragraphs.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      void justifyParagraph(entry.target as HTMLParagraphElement);
    }
  }, { rootMargin: "100% 0px" });
  for (const p of paragraphs) observer.observe(p);
  kpObserver = observer;
}

/** A resize recomposes only the paragraphs already composed (the rest still queues at the observer). */
function rejustifyComposed(): void {
  if (!app || currentLang.startsWith("zh")) return;
  for (const p of justifiedParagraphs()) {
    if (p.dataset.rich !== undefined) void justifyParagraph(p);
  }
}

function isDevHost(): boolean {
  const host = location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Both CJK families in one stack: each language's text resolves to the family it
 * would render with, regardless of the page the audit runs from.
 */
function allFontsFamily(): string {
  return [
    ...FONT_FACES.map((face) => `'${face.family}'`),
    "system-ui",
    "sans-serif",
  ].join(", ");
}

/** Dev-only, pretext-powered QA: warn if any section title must shrink to fit in any language. */
function auditTitles(): void {
  if (!isDevHost()) return;

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

  const tight = auditSectionTitles(labelsByLang, {
    ...DISPLAY_FONT,
    family: allFontsFamily(),
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

/**
 * Dev-only, pretext-powered QA for the nav bar: report, from any page and
 * without switching languages, how much room the shortcuts get once the brand
 * and the language switcher are paid for, and what `fitNavLinks` has to do to
 * them. `clipped` is the one that matters—it means the CSS floor is doing the
 * work and a label is actually being cut.
 *
 * The bar's geometry comes from the live DOM rather than from constants: the
 * row width, its gaps and the switcher cluster are all language-invariant, so
 * whichever page this runs on measures them correctly. Only meaningful at or
 * above `desktopMinRem`, where the shortcuts are on screen at all.
 */
function auditNav(): void {
  if (!isDevHost() || !app) return;

  const inner = app.querySelector<HTMLElement>(".nav__inner");
  const actions = app.querySelector<HTMLElement>(".nav__actions");
  if (!inner || !actions) return;
  if (globalThis.innerWidth < NAV_FIT.desktopMinRem * 16) return;

  const innerStyle = getComputedStyle(inner);
  const rowPx = inner.clientWidth -
    (parseFloat(innerStyle.paddingLeft) || 0) -
    (parseFloat(innerStyle.paddingRight) || 0);

  const perLang: Record<string, { brand: string; labels: string[] }> = {};
  for (const lang of LANGS) {
    const t = translations[lang];
    perLang[lang] = {
      brand: t.name.display,
      labels: NAV_LINKS.map((id) => t.nav[id]),
    };
  }

  const family = allFontsFamily();
  const entries = auditNavLinks(perLang, {
    rowPx,
    rowGapPx: parseFloat(innerStyle.columnGap) || 0,
    actionsPx: actions.getBoundingClientRect().width,
    // Mirrors `.nav__brand` in [src/styles.css](src/styles.css).
    brand: { weight: 600, letterSpacingEm: -0.01, sizePx: 15, family },
    link: { ...NAV_FONT, family, ...NAV_FIT },
  });

  const tight = entries.filter((entry) => !entry.fitsAtMax);
  if (tight.length > 0) {
    console.groupCollapsed(
      `[measure] nav shortcuts are fitted in ${tight.length} language(s)` +
        (tight.some((e) => e.clipped) ? " — SOME ARE CLIPPED" : ""),
    );
    console.table(entries);
    console.groupEnd();
  } else {
    console.info("[measure] nav shortcuts fit untouched in every language");
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

/** Count one stat up to its value—once, and instantly under reduced motion. */
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
  // view start counting now—the rest waits for its section to scroll in.
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
 * Rendering & navigation
 * ------------------------------------------------------------------ */

function bindEvents(): void {
  // Language links: real <a> (work without JS) intercepted for an instant,
  // reload-free switch that keeps the URL shareable via history.pushState.
  // Only the CV page switches in place: the client holds no post data, so on
  // home, index and article pages the switcher is plain navigation (spec §6.2).
  // The dev shell carries no data-kind and always re-renders the CV anyway.
  const kind = app?.querySelector(".page")?.getAttribute("data-kind");
  const switchInPlace = kind === "cv" || kind === null || kind === undefined;
  app?.querySelectorAll<HTMLAnchorElement>("a[data-lang]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const next = link.dataset.lang;
      // Let the browser handle every modified click itself—new tab/window
      // (meta/ctrl/shift) and download (alt) all mean "not an in-page switch".
      if (
        !switchInPlace ||
        !isLang(next) ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      ) {
        return;
      }
      event.preventDefault();
      // Record the choice even when nothing changes on screen. A French-browser
      // visitor sent to fr.html who clicks EN lands back on the root, where
      // `next === currentLang`—without storing first, the next visit would
      // negotiate them straight back to French and the switcher would look
      // broken. Only an explicit click stores; popstate never does.
      storeLang(next);
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

  // Dialogue: the phone's width control. Every drag re-tightens the bubbles,
  // which is the point—the widths come from a measurement, so they can follow
  // a width the reader chooses instead of the one the stylesheet assumed.
  const widthRange = app?.querySelector<HTMLInputElement>("[data-chat-width]");
  widthRange?.addEventListener("input", () => {
    setChatWidth(Number(widthRange.value));
  });

  // Contact closer: copy the WeChat id, flash the copied label on the button.
  const copyBtn = app?.querySelector<HTMLButtonElement>("[data-copy-wechat]");
  if (copyBtn) {
    // The idle label, read once at bind time (the button is freshly rendered):
    // during the restore window the button says "Copied", and a second click
    // must not capture that as the label to restore to.
    const idleLabel = copyBtn.textContent;
    let restore: ReturnType<typeof setTimeout> | undefined;
    copyBtn.addEventListener("click", () => {
      navigator.clipboard?.writeText(PROFILE.wechat).then(() => {
        clearTimeout(restore);
        copyBtn.textContent = copyBtn.dataset.copiedLabel ?? idleLabel;
        copyBtn.classList.add("is-copied");
        restore = setTimeout(() => {
          copyBtn.textContent = idleLabel;
          copyBtn.classList.remove("is-copied");
        }, 1600);
      }).catch(() => {
        // Clipboard denied—the id is printed right above the button anyway.
      });
    });
  }
}

function afterPaint(): void {
  observeSections();
  whenFontsReady(() => {
    applyMeasuredLayout();
    restoreChatWidth();
    enhanceChat();
    enhanceJustified();
  });
}

/**
 * The armed fade-out of a transition that hasn't painted yet. Two switches
 * inside PAGE_SWAP_MS would otherwise stack two paints, and the first one—
 * rendering an already-stale language—would land after the second.
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
 * `renderApp` would produce, so don't rebuild it—just bind events, sync the
 * theme toggle (pre-rendered as light) and start the enhancements.
 */
function hydrate(): void {
  bindEvents();
  syncThemeToggle();
  afterPaint();
}

/**
 * Back/forward move the URL, so the URL is what says which language to show—
 * never `<html data-lang>`. `setLang` overwrites that attribute on every switch,
 * so reading it here would report the language already on screen, every
 * comparison below would come out equal, and the history entry would be silently
 * ignored: the URL returned to `/` while the page stayed in French.
 */
function onPopState(): void {
  const next = langFromPath(location.pathname) ?? "en";
  if (next === currentLang) return;
  setLang(next);
  render(true);
}

function init(): void {
  setLang(pageLang(root.dataset.lang, location.pathname));
  const chosen = storedTheme();
  applyTheme(chosen ?? systemTheme(), false);

  const prerendered = app?.querySelector<HTMLElement>(".page");
  if (prerendered && prerendered.dataset.lang === currentLang) {
    hydrate();
  } else {
    render(false); // dev shell (loader) or stale markup
  }

  // Follow the OS appearance for as long as the visitor hasn't overridden it.
  // `addEventListener` on a MediaQueryList is Safari 14+; the `?.` on the call
  // keeps an older engine from throwing here, which would abort `init()` before
  // the popstate and resize listeners below are ever bound.
  globalThis.matchMedia?.(DARK_QUERY).addEventListener?.("change", (event) => {
    if (storedTheme()) return;
    applyTheme(event.matches ? "dark" : "light", false);
  });

  globalThis.addEventListener("popstate", onPopState);
  globalThis.addEventListener(
    "resize",
    debounce(() => {
      applyMeasuredLayout();
      enhanceChat();
      rejustifyComposed();
    }, 150),
    { passive: true },
  );
  // Dev-only diagnostic. The production build passes `features: ["PROD"]`, so
  // this branch compiles to `if (false)` and the whole audit (auditTitles +
  // auditSectionTitles) is tree-shaken out of the bundle; the dev server never
  // sets feature flags, so it always runs there.
  if (!feature("PROD")) {
    whenFontsReady(() => {
      auditTitles();
      auditNav();
    });
  }
}

init();
