/*
 * Rich text in a justified paragraph: read the styled runs of a rendered
 * paragraph, and rebuild it as computed lines without losing its markup.
 *
 * `runsFrom` is the DOM half (it needs computed styles); `buildLinesHtml` is
 * the pure half—the lines become a string of markup, so the whole assembly is
 * unit-testable without a document, and `renderLines` is one innerHTML write.
 *
 * The allowlist is the inline markup the article pipeline can emit
 * (scripts/markdown.ts): em, strong, code, a, del. Anything else an article
 * carries (it cannot) would be flattened into its parent's run.
 */

import { escapeHtml } from "./dom.ts";
import type { RichLine, Run } from "./linebreak.ts";

export type InlineTag = "a" | "code" | "del" | "em" | "strong";
const INLINE_TAGS: ReadonlySet<string> = new Set([
  "a",
  "code",
  "del",
  "em",
  "strong",
]);

/** A run as the breaker wants it (Run) plus what the renderer must rebuild. */
export interface RichRun extends Run {
  /** The inline elements wrapping this run's text, outermost first. */
  ancestors: readonly InlineTag[];
  /** The link target, when `a` is among the ancestors. */
  href?: string;
}

/** Horizontal padding and borders of one element, in px—what text measurement misses. */
function extraWidthOf(el: Element): number {
  const style = getComputedStyle(el);
  const px = (value: string) => Number.parseFloat(value) || 0;
  return px(style.paddingLeft) + px(style.paddingRight) +
    px(style.borderLeftWidth) + px(style.borderRightWidth);
}

/**
 * The styled runs of a paragraph, by walking its text nodes. Each run is
 * measured in the font of its deepest inline ancestor—the style the browser
 * will actually paint it with—because a bold or monospace span is wider than
 * the prose around it and a flat measurement computes lines that overflow.
 */
export function runsFrom(el: HTMLElement): RichRun[] {
  const runs: RichRun[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (!text) continue;

    // Ancestor chain from the paragraph down to the text node's element,
    // keeping only the inline markup the renderer reopens per line.
    const chain: Element[] = [];
    for (
      let parent = node.parentElement;
      parent && parent !== el;
      parent = parent.parentElement
    ) {
      chain.unshift(parent);
    }
    const inline = chain.filter((parent) =>
      INLINE_TAGS.has(parent.tagName.toLowerCase())
    );
    const deepest = inline[inline.length - 1] ?? null;
    const font = getComputedStyle(deepest ?? el).font;
    // Only inline code carries padding/borders here, but measure rather than
    // assume: any inline ancestor with horizontal box widths contributes them.
    const extraWidth = inline.reduce(
      (total, parent) => total + extraWidthOf(parent),
      0,
    );

    const link = inline.find((parent) => parent.tagName.toLowerCase() === "a");
    runs.push({
      text,
      font,
      ...(extraWidth > 0 ? { extraWidth } : {}),
      ancestors: inline.map((parent) =>
        parent.tagName.toLowerCase() as InlineTag
      ),
      ...(link ? { href: link.getAttribute("href") ?? "" } : {}),
    });
  }

  return runs;
}

/** One fragment, escaped, wrapped back in its run's inline chain. */
function fragmentHtml(text: string, run: RichRun): string {
  let html = escapeHtml(text);
  for (let i = run.ancestors.length - 1; i >= 0; i--) {
    const tag = run.ancestors[i]!;
    html = tag === "a"
      ? `<a href="${escapeHtml(run.href ?? "")}">${html}</a>`
      : `<${tag}>${html}</${tag}>`;
  }
  return html;
}

/**
 * The paragraph as one span per line, markup reopened inside each line. Pure:
 * the DOM half of the enhancement is a single innerHTML write of this string.
 */
export function buildLinesHtml(
  lines: readonly RichLine[],
  runs: readonly RichRun[],
): string {
  return lines
    .map((line) =>
      `<span class="kp-line">${
        line.fragments.map((f) => fragmentHtml(f.text, runs[f.run]!)).join("")
      }</span>`
    )
    .join("");
}

/** Rebuild the paragraph as computed lines, markup intact. */
export function renderLines(
  el: HTMLElement,
  lines: readonly RichLine[],
  runs: readonly RichRun[],
): void {
  el.innerHTML = buildLinesHtml(lines, runs);
}
