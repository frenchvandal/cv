/*
 * Measurement layer, powered by @chenglou/pretext.
 *
 * pretext measures text with the browser's font engine (canvas) WITHOUT touching
 * the DOM, so there is no layout reflow. We use it for three real, multilingual
 * fit problems that plain CSS `clamp()` only approximates:
 *
 *   1. fitHeroName —scale the hero name so its widest line fills the width.
 *   2. fitSectionTitles—size the sticky section titles so the longest one fits
 *      its column at every language, instead of being truncated with an ellipsis.
 *   3. fitNavLinks—tighten the nav shortcuts into the fixed width the bar
 *      leaves them, instead of letting them print over the language switcher.
 *
 * The site renders with self-hosted Noto Sans / Noto Sans SC/TC—named fonts,
 * which pretext requires for accuracy (system-ui is explicitly unsafe). Callers
 * pass the page's computed font stack via `FitFont.family` so CJK text is
 * measured with the family it actually renders in (SC on zh, TC on zh-hant).
 * Measurement waits for `document.fonts.ready` so it runs against the real
 * glyphs, and each fit keeps a small safety margin (MEASURE_SAFETY) as insurance
 * against sub-pixel rounding: the hero name lands a hair inside the edge, titles
 * shrink a touch early rather than clipping.
 */

import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";

/** Font size, in px, at which widths are measured before being scaled. */
const REFERENCE_PX = 100;

/** Fraction we shrink every fit by, as insurance against rounding—invisible, never overflows. */
const MEASURE_SAFETY = 0.98;

/**
 * Fallback stack when the caller passes no `family`. Latin-only; CJK pages must
 * pass the computed per-page stack (SC vs TC) for the measurement to be exact.
 */
const FONT_STACK = "'Noto Sans', system-ui, -apple-system, sans-serif";

/**
 * The type a fit measures against, and a contract with the stylesheet: the
 * values come from `DISPLAY_FONT` / `NAV_FONT` in [src/config.ts](src/config.ts)
 * and must match the CSS rule being fitted, or the measurement describes a font
 * the page never draws.
 */
export interface FitFont {
  weight: number;
  /** CSS `letter-spacing` in em (scales with font size). */
  letterSpacingEm: number;
  /** Defaults to the Latin stack; pass the page's computed one on CJK pages. */
  family?: string;
  /** CSS `font-style`. Defaults to `normal`. */
  style?: string;
}

/**
 * Width of `text` per 1px of font size, for the given font. Cached: pretext's
 * `prepare` pass is the expensive part, so we never repeat it for the same
 * (text, font)—exactly what the library asks for.
 */
const widthPerPxCache = new Map<string, number>();

function widthPerPx(text: string, font: FitFont): number {
  const family = font.family ?? FONT_STACK;
  const style = font.style ?? "normal";
  const key =
    `${style}|${font.weight}|${font.letterSpacingEm}|${family}|${text}`;
  const cached = widthPerPxCache.get(key);
  if (cached !== undefined) return cached;

  const spec = `${style} ${font.weight} ${REFERENCE_PX}px ${family}`;
  const prepared = prepareWithSegments(text, spec, {
    letterSpacing: font.letterSpacingEm * REFERENCE_PX,
    wordBreak: "keep-all",
  });
  const perPx = measureNaturalWidth(prepared) / REFERENCE_PX;
  widthPerPxCache.set(key, perPx);
  return perPx;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rootFontSize(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

export interface FitHeroOptions extends FitFont {
  minPx?: number;
  maxPx?: number;
  /** Fraction of the available width the name should occupy. */
  fill?: number;
}

/**
 * Sizes `nameEl` so its widest child line fills the available width. The element
 * is a block, so `clientWidth` tracks the container (not its nowrap text) and
 * never feeds back into the size we set—no measurement loop.
 */
export function fitHeroName(
  nameEl: HTMLElement,
  options: FitHeroOptions,
): void {
  const lines = Array.from(nameEl.children, (el) => el.textContent ?? "")
    .filter(Boolean);
  if (lines.length === 0) return;

  const widest = Math.max(...lines.map((line) => widthPerPx(line, options)));
  if (widest <= 0) return;

  const available = nameEl.clientWidth;
  if (available <= 0) return;

  const fill = (options.fill ?? 1) * MEASURE_SAFETY;
  const size = clamp(
    (available * fill) / widest,
    options.minPx ?? 32,
    options.maxPx ?? 160,
  );
  nameEl.style.fontSize = `${size}px`;
}

export interface FitTitlesOptions extends FitFont {
  minPx?: number;
  maxPx?: number;
  /** Column width the titles must fit within, in rem. */
  columnRem: number;
  /** Only fit at or above this viewport width (rem); below it, titles wrap. */
  desktopMinRem: number;
  /** The measurable label of a title element: its own text, ignoring any child. */
  label: (el: HTMLElement) => string;
}

/**
 * Gives every section title one uniform size: the largest size (capped at
 * `maxPx`) at which the *longest* title still fits the column. Prevents the
 * ellipsis truncation the CSS falls back to, and keeps titles visually
 * consistent as you scroll—across all seven languages. On narrow viewports
 * the titles wrap normally, so any inline size is cleared.
 */
export function fitSectionTitles(
  titleEls: HTMLElement[],
  options: FitTitlesOptions,
): void {
  const rem = rootFontSize();

  if (globalThis.innerWidth < options.desktopMinRem * rem) {
    for (const el of titleEls) el.style.removeProperty("font-size");
    return;
  }

  const target = options.columnRem * rem * MEASURE_SAFETY;
  const maxPx = options.maxPx ?? 72;
  const minPx = options.minPx ?? 28;

  let common = maxPx;
  for (const el of titleEls) {
    const perPx = widthPerPx(options.label(el), options);
    if (perPx <= 0) continue;
    common = Math.min(common, target / perPx);
  }
  common = clamp(common, minPx, maxPx);

  for (const el of titleEls) el.style.fontSize = `${common}px`;
}

/** The room the nav shortcuts may be squeezed into, in px. See `NAV_FIT`. */
export interface NavFitBounds {
  maxPx: number;
  minPx: number;
  maxGapPx: number;
  minGapPx: number;
}

export interface FitNavOptions extends FitFont, NavFitBounds {
  /** Only fit at or above this viewport width (rem); below it the links are hidden. */
  desktopMinRem: number;
}

export interface NavFit {
  fontPx: number;
  gapPx: number;
  /** True when the labels fit at the sizes the stylesheet declares. */
  natural: boolean;
  /** True when even `minPx`/`minGapPx` overrun the bar, so the CSS clips. */
  clipped: boolean;
}

/**
 * Fits the nav shortcuts into the width the bar leaves them, gap first and type
 * second. Returns the fit for the dev audit, or `null` when there is nothing to
 * do (no links, or below the breakpoint where they are hidden).
 *
 * `.nav__links` is `flex: 1` off a zero basis, so its width comes from the bar—
 * the brand and the language switcher—and never from the labels inside it.
 * That is what makes `clientWidth` safe to measure against here: shrinking the
 * text cannot widen the box and start a feedback loop.
 */
export function fitNavLinks(
  linksEl: HTMLElement,
  options: FitNavOptions,
): NavFit | null {
  const els = Array.from(linksEl.children) as HTMLElement[];

  // Always undo the previous fit first, so a resize (or a switch to a language
  // that fits) hands the stylesheet its own size and gap back rather than
  // leaving the last, tighter layout behind.
  linksEl.style.removeProperty("column-gap");
  for (const el of els) el.style.removeProperty("font-size");

  const gaps = els.length - 1;
  if (gaps < 1) return null;
  if (globalThis.innerWidth < options.desktopMinRem * rootFontSize()) {
    return null;
  }

  const available = linksEl.clientWidth * MEASURE_SAFETY;
  if (available <= 0) return null;

  // Width of the whole label set per 1px of type size: one prepare per label,
  // cached, so every later resize is arithmetic on five numbers.
  const perPx = els.reduce(
    (sum, el) => sum + widthPerPx(el.textContent ?? "", options),
    0,
  );
  if (perPx <= 0) return null;

  if (perPx * options.maxPx + options.maxGapPx * gaps <= available) {
    return {
      fontPx: options.maxPx,
      gapPx: options.maxGapPx,
      natural: true,
      clipped: false,
    };
  }

  // Spend the whitespace before the type: a tighter gap reads as a denser bar,
  // while a smaller label is a size the ramp does not otherwise contain.
  const gapPx = clamp(
    (available - perPx * options.maxPx) / gaps,
    options.minGapPx,
    options.maxGapPx,
  );
  const fontPx = clamp(
    (available - gapPx * gaps) / perPx,
    options.minPx,
    options.maxPx,
  );

  linksEl.style.columnGap = `${gapPx}px`;
  for (const el of els) el.style.fontSize = `${fontPx}px`;

  return {
    fontPx,
    gapPx,
    natural: false,
    clipped: perPx * fontPx + gapPx * gaps > available,
  };
}

export interface NavAuditEntry {
  lang: string;
  /** Width `.nav__links` gets once the brand and the switcher are paid for. */
  budgetPx: number;
  /** Width the labels want at `maxPx` and `maxGapPx`. */
  requiredPx: number;
  fontPx: number;
  gapPx: number;
  fitsAtMax: boolean;
  clipped: boolean;
}

export interface NavAuditOptions {
  /** Content width of the bar's flex row, in px (its `.wrap` less padding). */
  rowPx: number;
  /** Gap between the bar's three parts, in px. */
  rowGapPx: number;
  /** Width of the right-hand cluster—switcher plus theme toggle, in px. */
  actionsPx: number;
  /** The brand's type, whose width is the one part of the bar that varies by language. */
  brand: FitFont & { sizePx: number };
  /** The shortcuts' type, and how far the fitter may squeeze it. */
  link: FitFont & NavFitBounds;
}

/**
 * Dev-only, pretext-powered QA for the bar, and the reason this file measures
 * the brand as well as the labels: the budget is not one number. `.nav__brand`
 * is 112px of "Philippe Ribeiro" but 161px of 李北洛, so each language leaves
 * `.nav__links` a different width, and a label set that fits one page can
 * overrun another. Reports, per language and from any page, the width the
 * shortcuts want against the width they get.
 */
export function auditNavLinks(
  perLang: Record<string, { brand: string; labels: string[] }>,
  options: NavAuditOptions,
): NavAuditEntry[] {
  const { brand, link } = options;
  const entries: NavAuditEntry[] = [];

  for (const [lang, { brand: brandText, labels }] of Object.entries(perLang)) {
    const gaps = labels.length - 1;
    if (gaps < 1) continue;

    const brandPx = widthPerPx(brandText, brand) * brand.sizePx;
    const budgetPx =
      (options.rowPx - brandPx - options.actionsPx - 2 * options.rowGapPx) *
      MEASURE_SAFETY;
    const perPx = labels.reduce((sum, l) => sum + widthPerPx(l, link), 0);
    const requiredPx = perPx * link.maxPx + link.maxGapPx * gaps;

    const gapPx = clamp(
      (budgetPx - perPx * link.maxPx) / gaps,
      link.minGapPx,
      link.maxGapPx,
    );
    const fontPx = clamp(
      (budgetPx - gapPx * gaps) / perPx,
      link.minPx,
      link.maxPx,
    );

    entries.push({
      lang,
      budgetPx: Math.round(budgetPx),
      requiredPx: Math.round(requiredPx),
      fontPx: Math.round(fontPx * 100) / 100,
      gapPx: Math.round(gapPx * 10) / 10,
      fitsAtMax: requiredPx <= budgetPx,
      clipped: perPx * fontPx + gapPx * gaps > budgetPx,
    });
  }
  return entries;
}

/**
 * The two measurement inputs an element's computed style implies: the CSS
 * `font` shorthand, and the tracking—which pretext takes as a separate
 * option, because `letter-spacing` is not part of that shorthand and would be
 * dropped on the floor by a caller that only builds the string.
 *
 * The fits above take their font from a `FitFont` constant kept in sync with
 * the stylesheet by hand ([src/config.ts](src/config.ts)); the two callers that
 * measure body text—the chat bubbles and the justified KP paragraphs—read
 * theirs from the live computed style instead, and this is what keeps that read
 * complete. Both elements happen to inherit no tracking today, so the widths
 * are right either way; adding `letter-spacing` to body text is what this
 * guards against, since it would otherwise skew every width silently.
 */
export function fontSpecFrom(
  style: CSSStyleDeclaration,
): { font: string; letterSpacing: number } {
  return {
    font:
      `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
    // `normal`—the initial value, and what an untracked element reports—
    // parses to NaN, which `||` turns into the 0 px pretext expects.
    letterSpacing: parseFloat(style.letterSpacing) || 0,
  };
}

/** Resolves once web fonts are loaded, so measurement uses the real glyphs. */
export function whenFontsReady(callback: () => void): void {
  const fonts = document.fonts;
  if (fonts && typeof fonts.ready?.then === "function") {
    fonts.ready.then(callback);
  } else {
    callback();
  }
}

/** Trailing debounce, used for resize-driven re-fits. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export interface AuditEntry {
  lang: string;
  label: string;
  requiredPx: number;
  maxPx: number;
  fitsAtMax: boolean;
}

/**
 * Dev-only, pretext-powered QA: without switching languages or touching the DOM,
 * report any section title that cannot render at `maxPx` within its column in
 * any of the seven languages—i.e., that the fitter must shrink. Catches a
 * localized label that would otherwise overflow, browser-tab-free.
 */
export function auditSectionTitles(
  labelsByLang: Record<string, string[]>,
  options: { columnRem: number; maxPx: number } & FitFont,
): AuditEntry[] {
  const target = options.columnRem * rootFontSize() * MEASURE_SAFETY;
  const entries: AuditEntry[] = [];

  for (const [lang, labels] of Object.entries(labelsByLang)) {
    for (const label of labels) {
      const perPx = widthPerPx(label, options);
      const requiredPx = perPx > 0 ? target / perPx : options.maxPx;
      entries.push({
        lang,
        label,
        requiredPx: Math.round(requiredPx),
        maxPx: options.maxPx,
        fitsAtMax: requiredPx >= options.maxPx,
      });
    }
  }
  return entries;
}
