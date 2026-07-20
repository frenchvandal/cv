/*
 * Knuth–Plass optimal line breaking with syllable hyphenation, measured by pretext.
 *
 * Browsers break paragraphs greedily, line by line. Knuth–Plass instead chooses
 * the set of breakpoints that minimises the *total* raggedness of the whole
 * paragraph (the algorithm behind TeX), giving noticeably more even lines. We
 * feed it two things:
 *   - box/glue widths measured with pretext (accurate, no DOM reflow), and
 *   - optional break points inside words from Liang hyphenation patterns (`hyphen`).
 *
 * The result is rendered justified, one <span> per line, with a real hyphen where
 * a word was split. Runs on the client only (pretext needs a canvas) as an
 * enhancement over the plain, pre-rendered paragraph. The hyphenation patterns
 * are `import()`ed on demand, so a visitor only downloads the patterns of the
 * language they are reading (and Chinese pages download none). Measurement is
 * injectable, so the algorithm is unit-testable without a canvas
 * (see linebreak.test.ts).
 */

import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import type { Lang } from "./translations.ts";

const SOFT_HYPHEN = "­";
const INF = 10000;

/** Width of `text` in px when rendered with the CSS `font` shorthand. */
export type MeasureFn = (text: string, font: string) => number;

type BreakItem =
  | { type: "box"; width: number; text: string }
  | { type: "glue"; width: number; stretch: number; shrink: number }
  | { type: "penalty"; width: number; penalty: number; flagged: boolean };

const widthCache = new Map<string, number>();

const measureWithPretext: MeasureFn = (text, font) => {
  // NUL separator: neither string can contain it, so keys never collide.
  const key = `${font}\u0000${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  const width = measureNaturalWidth(prepareWithSegments(text, font));
  widthCache.set(key, width);
  return width;
};

/**
 * A Liang-pattern hyphenator: accepts any text and returns it with soft
 * hyphens (U+00AD) inserted at syllable boundaries.
 */
type Hyphenate = (text: string) => string;

const hyphenators = new Map<Lang, Promise<Hyphenate | null>>();

/**
 * Lazily load the hyphenation patterns for `lang`; resolves to null where
 * hyphenation doesn't apply (Chinese wraps per character). Cached per language.
 */
function loadHyphenator(lang: Lang): Promise<Hyphenate | null> {
  let loading = hyphenators.get(lang);
  if (!loading) {
    loading = (lang === "en"
      ? import("hyphen/en").then((m) =>
        m.hyphenateSync
      )
      : lang === "fr"
      ? import("hyphen/fr").then((m) => m.hyphenateSync)
      : Promise.resolve(null))
      .catch(() => {
        // A transient chunk-load failure must not cost hyphenation for the rest
        // of the session: drop the rejected promise so the next caller (a
        // resize, a language switch) retries the import instead of re-awaiting
        // the failure. This run degrades to unhyphenated line breaking.
        hyphenators.delete(lang);
        return null;
      });
    hyphenators.set(lang, loading);
  }
  return loading;
}

/**
 * Split a word at the break opportunities it already carries: after an existing
 * hyphen (`customer-facing`, `cross-company`, `full-time`). The Liang patterns
 * never offer these — `hyphen` turns `customer-facing` into `cus-tomer-fac-ing`
 * and leaves the hard hyphen itself unbreakable — yet they are the cheapest
 * breaks available, since the character is already printed. The hyphen stays on
 * the left fragment, so nothing extra is drawn.
 *
 * Slashes are deliberately *not* break points: in prose they nearly always join
 * an acronym pair (`SAML/OIDC`, `TCP/IP`), and splitting those over two lines
 * reads far worse than a loose line does.
 *
 * A one-character fragment is never worth a line end, so both sides need two.
 */
function splitOnHardBreaks(word: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < word.length - 1; i++) {
    if (word[i] !== "-") continue;
    if (i + 1 - start < 2) continue; // too little before the break
    if (word.length - (i + 1) < 2) continue; // too little after it
    parts.push(word.slice(start, i + 1));
    start = i + 1;
  }
  parts.push(word.slice(start));
  return parts;
}

/** Build the Knuth–Plass box/glue/penalty stream for one paragraph. */
function buildItems(
  text: string,
  font: string,
  hyphenate: Hyphenate,
  measure: MeasureFn,
): BreakItem[] {
  const spaceWidth = Math.max(1, measure("x x", font) - measure("xx", font));
  const hyphenWidth = measure("-", font);
  // Split on breakable whitespace only: NBSP (U+00A0) and NNBSP (U+202F) stay
  // inside their word, so French typographic spaces never become break points.
  const words = text.trim().split(/[^\S\u00A0\u202F]+/u).filter(Boolean);
  const items: BreakItem[] = [];

  words.forEach((word, wordIndex) => {
    splitOnHardBreaks(word).forEach((segment, segmentIndex) => {
      if (segmentIndex > 0) {
        // Free break, and unflagged: the hyphen is already on the line above,
        // so this costs no extra glyph and two in a row are not the "two
        // hyphenated lines in succession" that TeX penalises.
        items.push({ type: "penalty", width: 0, penalty: 25, flagged: false });
      }
      hyphenate(segment).split(SOFT_HYPHEN).forEach(
        (fragment, fragmentIndex) => {
          if (fragmentIndex > 0) {
            items.push({
              type: "penalty",
              width: hyphenWidth,
              penalty: 50,
              flagged: true,
            });
          }
          items.push({
            type: "box",
            width: measure(fragment, font),
            text: fragment,
          });
        },
      );
    });
    if (wordIndex < words.length - 1) {
      // shrink: 0 — CSS `text-align: justify` can only stretch spaces, never
      // shrink them, so we forbid shrinking here too. Every chosen line is then
      // ≤ the target width and the browser fills it by stretching, never wraps.
      items.push({
        type: "glue",
        width: spaceWidth,
        stretch: spaceWidth / 2,
        shrink: 0,
      });
    }
  });

  // Finish the paragraph: infinitely stretchable glue, then a forced break.
  items.push({ type: "glue", width: 0, stretch: INF, shrink: 0 });
  items.push({ type: "penalty", width: 0, penalty: -INF, flagged: false });
  return items;
}

interface Node {
  position: number;
  line: number;
  fitness: number;
  totalWidth: number;
  totalStretch: number;
  totalShrink: number;
  totalDemerits: number;
  previous: Node | null;
}

/** Core optimum-fit algorithm. Returns breakpoint item indices, or null if infeasible. */
function optimalBreaks(
  items: BreakItem[],
  lineWidth: number,
  tolerance: number,
): number[] | null {
  const active = new Set<Node>();
  active.add({
    position: 0,
    line: 0,
    fitness: 1,
    totalWidth: 0,
    totalStretch: 0,
    totalShrink: 0,
    totalDemerits: 0,
    previous: null,
  });

  const sum = { width: 0, stretch: 0, shrink: 0 };
  const LINE_PENALTY = 10;
  const FLAGGED_DEMERIT = 3000;
  const FITNESS_DEMERIT = 3000;

  // Sums just after a breakpoint, skipping the glue that collapses at a line start.
  function sumAfter(
    breakIndex: number,
  ): { width: number; stretch: number; shrink: number } {
    const acc = { width: sum.width, stretch: sum.stretch, shrink: sum.shrink };
    for (let i = breakIndex; i < items.length; i++) {
      const item = items[i]!;
      if (item.type === "box") break;
      if (item.type === "glue") {
        acc.width += item.width;
        acc.stretch += item.stretch;
        acc.shrink += item.shrink;
      } else if (
        item.type === "penalty" && item.penalty <= -INF && i > breakIndex
      ) {
        break;
      }
    }
    return acc;
  }

  function consider(index: number): void {
    const item = items[index]!;
    const best: { node: Node | null; demerits: number }[] = [
      { node: null, demerits: Infinity },
      { node: null, demerits: Infinity },
      { node: null, demerits: Infinity },
      { node: null, demerits: Infinity },
    ];

    for (const a of active) {
      let width = sum.width - a.totalWidth;
      if (item.type === "penalty") width += item.width;

      let ratio: number;
      if (width < lineWidth) {
        const stretch = sum.stretch - a.totalStretch;
        ratio = stretch > 0 ? (lineWidth - width) / stretch : INF;
      } else if (width > lineWidth) {
        const shrink = sum.shrink - a.totalShrink;
        ratio = shrink > 0 ? (lineWidth - width) / shrink : -INF;
      } else {
        ratio = 0;
      }

      const forced = item.type === "penalty" && item.penalty <= -INF;
      if (ratio < -1 || forced) active.delete(a);

      if (ratio >= -1 && ratio <= tolerance) {
        const badness = 100 * Math.abs(ratio) ** 3;
        const penalty = item.type === "penalty" ? item.penalty : 0;
        let demerits: number;
        if (penalty >= 0) demerits = (LINE_PENALTY + badness + penalty) ** 2;
        else if (penalty > -INF) {
          demerits = (LINE_PENALTY + badness) ** 2 - penalty ** 2;
        } else demerits = (LINE_PENALTY + badness) ** 2;

        const prev = items[a.position];
        if (
          item.type === "penalty" && item.flagged && prev?.type === "penalty" &&
          prev.flagged
        ) {
          demerits += FLAGGED_DEMERIT;
        }

        const fitness = ratio < -0.5
          ? 0
          : ratio <= 0.5
          ? 1
          : ratio <= 1
          ? 2
          : 3;
        if (Math.abs(fitness - a.fitness) > 1) demerits += FITNESS_DEMERIT;

        demerits += a.totalDemerits;
        if (demerits < best[fitness]!.demerits) {
          best[fitness] = { node: a, demerits };
        }
      }
    }

    const after = sumAfter(index);
    for (let fitness = 0; fitness < 4; fitness++) {
      const candidate = best[fitness]!;
      if (!candidate.node) continue;
      active.add({
        position: index,
        line: candidate.node.line + 1,
        fitness,
        totalWidth: after.width,
        totalStretch: after.stretch,
        totalShrink: after.shrink,
        totalDemerits: candidate.demerits,
        previous: candidate.node,
      });
    }
  }

  items.forEach((item, index) => {
    if (item.type === "box") {
      sum.width += item.width;
    } else if (item.type === "glue") {
      if (index > 0 && items[index - 1]!.type === "box") consider(index);
      sum.width += item.width;
      sum.stretch += item.stretch;
      sum.shrink += item.shrink;
    } else if (item.penalty < INF) {
      consider(index);
    }
  });

  if (active.size === 0) return null;

  let chosen: Node | null = null;
  for (const node of active) {
    if (!chosen || node.totalDemerits < chosen.totalDemerits) chosen = node;
  }

  const breaks: number[] = [];
  for (let node = chosen; node && node.position > 0; node = node.previous) {
    breaks.unshift(node.position);
  }
  return breaks;
}

/** Turn chosen breakpoints back into line strings, adding a hyphen where a word was split. */
function toLines(items: BreakItem[], breaks: number[]): string[] {
  const lines: string[] = [];
  let start = 0;

  for (const breakIndex of breaks) {
    let text = "";
    for (let i = start; i < breakIndex; i++) {
      const item = items[i]!;
      if (item.type === "box") text += item.text;
      else if (item.type === "glue") text += " ";
    }
    text = text.trim();
    const breakItem = items[breakIndex]!;
    if (breakItem.type === "penalty" && breakItem.flagged) text += "-";
    lines.push(text);

    start = breakIndex + 1;
    while (start < items.length && items[start]!.type === "glue") start++;
  }

  return lines;
}

/**
 * Break `text` into optimal justified lines for the given font and column width.
 * Resolves to null when the language isn't hyphenated here (e.g. Chinese) or no
 * feasible layout is found — the caller then keeps the plain paragraph.
 * `measure` defaults to pretext (canvas); tests inject a synthetic one.
 */
export async function breakIntoLines(
  text: string,
  font: string,
  lineWidth: number,
  lang: Lang,
  measure: MeasureFn = measureWithPretext,
): Promise<string[] | null> {
  if (lineWidth <= 0) return null;
  const hyphenate = await loadHyphenator(lang);
  if (!hyphenate) return null;
  const items = buildItems(text, font, hyphenate, measure);
  // Prefer tight lines; loosen tolerance only if no feasible layout is found.
  // (Raising the ceiling never *buys* looseness: badness goes as ratio³, so the
  // optimiser still picks the tight layout whenever one exists.)
  const breaks = optimalBreaks(items, lineWidth, 3) ??
    optimalBreaks(items, lineWidth, 12);
  if (!breaks || breaks.length === 0) return null;
  return toLines(items, breaks);
}
