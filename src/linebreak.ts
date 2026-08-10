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
 * The paragraph arrives as styled RUNS, not as one string: every box is
 * measured in the font of the run it came from, because a bold or monospace
 * span is wider than the prose around it (measured in Chrome: +1.5% for bold,
 * +8.1% for monospace—enough for a line to overflow, at which point the browser
 * re-wraps it and destroys the justification just computed), and its markup
 * comes back out through the returned fragments. A run may carry
 * `extraWidth`—the horizontal padding and borders text measurement ignores, as
 * inline `<code>` has; such a run is kept atomic, never split and never
 * hyphenated, and charged its full extra width, so padding drawn at its edges
 * can never overflow the computed line.
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

/**
 * One styled span of the paragraph. `font` is the CSS shorthand the run is
 * measured in; `extraWidth` is the horizontal space text measurement misses
 * (padding, borders—inline code), and it makes the run atomic.
 */
export interface Run {
  text: string;
  font: string;
  extraWidth?: number;
}

/**
 * A laid-out line, as the styled pieces it is made of. `run` indexes the runs.
 *
 * `hyphenated` marks a line that ends mid-word, and the hyphen it needs is NOT
 * in `fragments`: it is presentation, and putting it in the text put it in the
 * clipboard. Measured in Chrome — copying three computed lines yielded
 * "un do-\ncument traduit", a word no reader ever wrote. The renderer draws it
 * from CSS instead, where a selection cannot reach it.
 */
export type RichLine = {
  fragments: { text: string; run: number }[];
  hyphenated?: boolean;
};

type BreakItem =
  | { type: "box"; width: number; text: string; run: number }
  | { type: "glue"; width: number; stretch: number; shrink: number }
  | { type: "penalty"; width: number; penalty: number; flagged: boolean };

const widthCache = new Map<string, number>();

/**
 * Widths from pretext, for text tracked by `letterSpacing` px. The tracking is
 * a separate argument because CSS `letter-spacing` is not part of the `font`
 * shorthand pretext parses—measuring a tracked paragraph without it would
 * break its lines at the wrong column. It is keyed into the width cache for
 * the same reason.
 */
export function pretextMeasure(letterSpacing = 0): MeasureFn {
  return (text, font) => measureCached(text, font, letterSpacing);
}

function measureCached(
  text: string,
  font: string,
  letterSpacing: number,
): number {
  // NUL separator: neither string can contain it, so keys never collide. The
  // tracking is a number, so a plain space separates it unambiguously.
  const key = `${letterSpacing} ${font}\u0000${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  const width = measureNaturalWidth(
    prepareWithSegments(text, font, { letterSpacing }),
  );
  widthCache.set(key, width);
  return width;
}

/**
 * A Liang-pattern hyphenator: accepts any text and returns it with soft
 * hyphens (U+00AD) inserted at syllable boundaries.
 */
type Hyphenate = (text: string) => string;

const hyphenators = new Map<Lang, Promise<Hyphenate | null>>();

/**
 * Lazily load the hyphenation patterns for `lang`; resolves to null where
 * hyphenation doesn’t apply (Chinese wraps per character). Cached per language.
 */
/**
 * The pattern module for a language, or null where hyphenation doesn’t apply.
 * Every specifier is a literal so the bundler can see them and split each
 * language’s patterns into its own chunk—build them from a variable and
 * `splitting: true` has nothing to split. The switch is exhaustive over `Lang`,
 * so adding a language is a compile error here until it is answered for.
 */
function importPatterns(
  lang: Lang,
): Promise<{ hyphenateSync: Hyphenate }> | null {
  switch (lang) {
    case "en":
      return import("hyphen/en");
    case "fr":
      return import("hyphen/fr");
    case "pt":
      return import("hyphen/pt");
    case "es":
      return import("hyphen/es");
    // Chinese wraps per character; there are no syllable patterns to fetch.
    case "zh":
    case "zh-hant":
    case "zh-hk":
      return null;
  }
}

function loadHyphenator(lang: Lang): Promise<Hyphenate | null> {
  let loading = hyphenators.get(lang);
  if (!loading) {
    const patterns = importPatterns(lang);
    const resolving: Promise<Hyphenate | null> = patterns
      ? patterns.then((m) => m.hyphenateSync)
      : Promise.resolve(null);
    loading = resolving
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
 * never offer these—`hyphen` turns `customer-facing` into `cus-tomer-fac-ing`
 * and leaves the hard hyphen itself unbreakable—yet they are the cheapest
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

/**
 * One word of the paragraph, as the styled pieces it spans. A word is usually
 * one piece; it is several only when markup opens or closes mid-word
 * (`wo<strong>rd</strong>`).
 */
type Word = { pieces: { text: string; run: number }[] };

/*
 * Breakable whitespace: NBSP (U+00A0) and NNBSP (U+202F) stay inside their
 * word, so French typographic spaces never become break points. `WS_SPLIT`
 * keeps the separators (a capturing group) so the tokenizer sees where each
 * word ends; `WS_ONLY` is the anchored form used to
 * recognize them\u2014hoisted rather than rebuilt per chunk, since this runs once
 * per paragraph per resize.
 */
const WS_SPLIT = /([^\S\u00A0\u202F]+)/u;
const WS_ONLY = /^[^\S\u00A0\u202F]+$/u;

/**
 * Tokenize the runs into words. Whitespace in any run separates words, and the
 * scan crosses run boundaries rather than restarting at each one\u2014otherwise the
 * space in `<em>the</em> end` would be lost along with the
 * boundary it marks. A run carrying `extraWidth` (inline
 * code) is never split: its padding is drawn at its edges, so letting it wrap
 * would draw unmeasured width on both lines.
 */
function splitRunsIntoWords(runs: readonly Run[]): Word[] {
  const words: Word[] = [];
  let current: Word = { pieces: [] };

  const flush = () => {
    if (current.pieces.length > 0) words.push(current);
    current = { pieces: [] };
  };

  runs.forEach((run, runIndex) => {
    if (run.extraWidth) {
      if (run.text.trim()) {
        current.pieces.push({ text: run.text.trim(), run: runIndex });
      }
      return;
    }
    for (const chunk of run.text.split(WS_SPLIT)) {
      if (chunk === "") continue;
      if (WS_ONLY.test(chunk)) flush();
      else current.pieces.push({ text: chunk, run: runIndex });
    }
  });
  flush();
  return words;
}

/**
 * Build the Knuth\u2013Plass box/glue/penalty stream for a paragraph of styled
 * runs. Every box is measured in the font of the run it came from\u2014that is the
 * whole point: a bold or monospace span is wider than the prose around it, and
 * measuring it flat makes the optimizer choose breakpoints for a line that
 * does not exist.
 *
 * Hyphenation applies to single-piece words only. A word straddling a run
 * boundary becomes consecutive boxes with no break between them: splitting it
 * would put the hyphen inside markup, and the case is rare enough that the
 * lost break opportunity costs nothing measurable.
 */
function buildItems(
  runs: readonly Run[],
  hyphenate: Hyphenate,
  measure: MeasureFn,
): BreakItem[] {
  const baseFont = runs[0]?.font ?? "";
  const spaceWidth = Math.max(
    1,
    measure("x x", baseFont) - measure("xx", baseFont),
  );
  const words = splitRunsIntoWords(runs);
  const items: BreakItem[] = [];

  words.forEach((word, wordIndex) => {
    if (word.pieces.length === 1) {
      const { text, run } = word.pieces[0]!;
      const { font, extraWidth = 0 } = runs[run]!;

      if (extraWidth > 0) {
        // An atomic run (inline code): one box, no hyphenation, padding paid.
        items.push({
          type: "box",
          width: measure(text, font) + extraWidth,
          text,
          run,
        });
      } else {
        const hyphenWidth = measure("-", font);
        splitOnHardBreaks(text).forEach((segment, segmentIndex) => {
          if (segmentIndex > 0) {
            // Free break, and unflagged: the hyphen is already on the line
            // above, so this costs no extra glyph and two in a row are not the
            // "two hyphenated lines in succession" that TeX penalises.
            items.push({
              type: "penalty",
              width: 0,
              penalty: 25,
              flagged: false,
            });
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
                run,
              });
            },
          );
        });
      }
    } else {
      // A word split by markup: consecutive boxes, no break between them.
      for (const piece of word.pieces) {
        const { font, extraWidth = 0 } = runs[piece.run]!;
        items.push({
          type: "box",
          width: measure(piece.text, font) + extraWidth,
          text: piece.text,
          run: piece.run,
        });
      }
    }

    if (wordIndex < words.length - 1) {
      // shrink: 0—CSS `text-align: justify` can only stretch spaces, never
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

/**
 * Turn chosen breakpoints back into lines, adding a hyphen where a word was
 * split. Consecutive boxes from the same run coalesce into one fragment, so a
 * line that crosses no style boundary comes back as a single piece and the
 * renderer only has to open an element where the style actually changes.
 */
function toLines(items: BreakItem[], breaks: number[]): RichLine[] {
  const lines: RichLine[] = [];
  let start = 0;

  for (const breakIndex of breaks) {
    const fragments: { text: string; run: number }[] = [];

    const push = (text: string, run: number) => {
      const last = fragments[fragments.length - 1];
      if (last && last.run === run) last.text += text;
      else fragments.push({ text, run });
    };

    for (let i = start; i < breakIndex; i++) {
      const item = items[i]!;
      if (item.type === "box") push(item.text, item.run);
      else if (item.type === "glue" && fragments.length > 0) {
        // The space belongs to the run on its left, which is what decides the
        // style the stretched space is painted in.
        push(" ", fragments[fragments.length - 1]!.run);
      }
    }

    // Trim the line’s outer whitespace without losing fragment boundaries.
    if (fragments.length > 0) {
      fragments[0]!.text = fragments[0]!.text.replace(/^\s+/u, "");
      const last = fragments[fragments.length - 1]!;
      last.text = last.text.replace(/\s+$/u, "");
    }

    const breakItem = items[breakIndex]!;
    const hyphenated = breakItem.type === "penalty" && breakItem.flagged;

    lines.push({
      fragments: fragments.filter((f) => f.text !== ""),
      ...(hyphenated ? { hyphenated: true } : {}),
    });

    start = breakIndex + 1;
    while (start < items.length && items[start]!.type === "glue") start++;
  }

  return lines;
}

/**
 * Break a paragraph of styled runs into optimal justified lines for its column
 * width. Resolves to null when the language isn’t hyphenated here (e.g.,
 * Chinese) or no feasible layout is found—the caller then keeps the plain
 * paragraph. `measure` defaults to pretext (canvas) with no tracking; a caller
 * whose paragraph carries `letter-spacing` passes `pretextMeasure(px)`
 * instead, and tests inject a synthetic one.
 */
export async function breakIntoLines(
  runs: readonly Run[],
  lineWidth: number,
  lang: Lang,
  measure: MeasureFn = pretextMeasure(),
): Promise<RichLine[] | null> {
  if (lineWidth <= 0 || runs.length === 0) return null;
  const hyphenate = await loadHyphenator(lang);
  if (!hyphenate) return null;
  const items = buildItems(runs, hyphenate, measure);
  // Prefer tight lines; loosen tolerance only if no feasible layout is found.
  // (Raising the ceiling never *buys* looseness: badness goes as ratio³, so the
  // optimiser still picks the tight layout whenever one exists.)
  const breaks = optimalBreaks(items, lineWidth, 3) ??
    optimalBreaks(items, lineWidth, 12);
  if (!breaks || breaks.length === 0) return null;
  return toLines(items, breaks);
}

/**
 * The flat-text case: one run, no markup. Every property the tests assert—
 * where a line breaks, where a hyphen lands, that words survive the round
 * trip—is a property of the breaker, not of the markup, and they read far
 * better against strings. This is the degenerate call, not a second path.
 */
export async function breakIntoLinesFlat(
  text: string,
  font: string,
  lineWidth: number,
  lang: Lang,
  measure: MeasureFn = pretextMeasure(),
): Promise<string[] | null> {
  const lines = await breakIntoLines(
    [{ text, font }],
    lineWidth,
    lang,
    measure,
  );
  // The flat contract keeps the hyphen in the string: its caller has no CSS to
  // draw one with, and the tests read better for it.
  return lines?.map((line) =>
    line.fragments.map((f) => f.text).join("") + (line.hyphenated ? "-" : "")
  ) ?? null;
}
