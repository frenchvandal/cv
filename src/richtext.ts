/*
 * Rich text in a justified paragraph: read the styled runs of a rendered
 * paragraph, and rebuild it as computed lines without losing its markup.
 *
 * The rebuild clones the paragraph’s own elements rather than re-serializing
 * an allowlist of tag names. That is the whole design, and it buys three
 * things at once:
 *
 *   - every attribute survives. The Markdown pipeline puts
 *     `rel="noopener noreferrer"` on external links and `lang="zh-Hans"` on
 *     Chinese runs (scripts/markdown.ts); a rebuild that only knew `<a href>`
 *     would silently drop the first and the second entirely, turning an
 *     accessibility guarantee and a security attribute into casualties of
 *     typesetting.
 *   - there is no allowlist to keep in step with the renderer. Whatever inline
 *     markup an article grows next is reopened by construction.
 *   - nothing is escaped, because nothing is serialized: text goes back as
 *     text nodes, so the class of bug where a `<` in prose becomes markup
 *     cannot arise here at all.
 *
 * What it will not do is guess. A paragraph holding an element with no text of
 * its own—`<br>`, `<img>`—cannot be rebuilt from its text nodes, so
 * `runsFrom` returns null for it and the caller leaves the browser’s own
 * justification alone. Dropping a line break to gain an even measure is not a
 * trade this file is willing to make silently.
 */

import type { RichLine, Run } from "./linebreak.ts";

/** A run as the breaker wants it, plus the elements the renderer must reopen. */
export interface RichRun extends Run {
  /** The inline elements wrapping this run’s text, outermost first. */
  chain: readonly Element[];
}

/** Horizontal padding and borders of one element, in px—what text measurement misses. */
function extraWidthOf(style: CSSStyleDeclaration): number {
  const px = (value: string) => Number.parseFloat(value) || 0;
  return px(style.paddingLeft) + px(style.paddingRight) +
    px(style.borderLeftWidth) + px(style.borderRightWidth);
}

/**
 * The styled runs of a paragraph, by walking its text nodes—or null when the
 * paragraph carries markup this file refuses to rebuild (see the header).
 *
 * Each run is measured in the font of its deepest ancestor, the style the
 * browser will actually paint it with: a bold or monospace span is wider than
 * the prose around it, and a flat measurement computes lines that overflow.
 */
export function runsFrom(el: HTMLElement): RichRun[] | null {
  const runs: RichRun[] = [];
  const styles = new Map<Element, CSSStyleDeclaration>();
  const styleOf = (node: Element): CSSStyleDeclaration => {
    let style = styles.get(node);
    if (!style) {
      style = getComputedStyle(node);
      styles.set(node, style);
    }
    return style;
  };

  // Every descendant element has to hold text, or cloning the chains of the
  // text nodes would leave it behind. One <br> is enough to refuse.
  const withText = new Set<Element>();
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";

    const chain: Element[] = [];
    for (
      let parent = node.parentElement;
      parent && parent !== el;
      parent = parent.parentElement
    ) {
      chain.unshift(parent);
      if (text.trim()) withText.add(parent);
    }

    if (!text) continue;
    const deepest = chain[chain.length - 1];
    const extraWidth = chain.reduce(
      (total, parent) => total + extraWidthOf(styleOf(parent)),
      0,
    );

    runs.push({
      text,
      font: styleOf(deepest ?? el).font,
      ...(extraWidth > 0 ? { extraWidth } : {}),
      chain,
    });
  }

  for (const descendant of el.querySelectorAll("*")) {
    if (!withText.has(descendant)) return null;
  }
  return runs.length > 0 ? runs : null;
}

/**
 * Rebuild the paragraph as one `.kp-line` span per line, each run’s elements
 * reopened inside it.
 *
 * Consecutive fragments sharing a prefix of their chain share the clones of
 * that prefix, so a line that never leaves an `<em>` gets one `<em>`, not one
 * per fragment. The whole assembly lands in a fragment first and replaces the
 * paragraph’s children in a single write, so the reader never sees a half-set
 * paragraph.
 */
export function renderLines(
  el: HTMLElement,
  lines: readonly RichLine[],
  runs: readonly RichRun[],
): void {
  const doc = el.ownerDocument;
  const out = doc.createDocumentFragment();

  for (const line of lines) {
    const lineEl = doc.createElement("span");
    lineEl.className = "kp-line";
    // Two attributes, two facts. `data-hyphen` DRAWS a hyphen the text does
    // not contain; `data-word-break` says the next line continues this word,
    // which is also true when the word already carried its own hyphen
    // (`cross-` / `company`). Copying reads the second, CSS the first.
    if (line.hyphenated) lineEl.dataset.hyphen = "";
    if (line.midWord) lineEl.dataset.wordBreak = "";

    // The chain currently open, as source elements and as their clones—the
    // first says what may be reused, the second is where text goes.
    let open: readonly Element[] = [];
    let clones: Element[] = [];

    for (const fragment of line.fragments) {
      const chain = runs[fragment.run]!.chain;

      let shared = 0;
      while (
        shared < chain.length && shared < open.length &&
        chain[shared] === open[shared]
      ) shared++;

      clones = clones.slice(0, shared);
      for (let i = shared; i < chain.length; i++) {
        const clone = chain[i]!.cloneNode(false) as Element;
        (clones[i - 1] ?? lineEl).appendChild(clone);
        clones.push(clone);
      }
      open = chain;

      (clones[clones.length - 1] ?? lineEl).appendChild(
        doc.createTextNode(fragment.text),
      );
    }

    out.appendChild(lineEl);
  }

  el.replaceChildren(out);
}

/**
 * The paragraph as the author wrote it, from a selection over computed lines—
 * or null when this selection is not one this function should touch.
 *
 * Composing a paragraph into one block per line changes what copying it
 * yields: the browser puts a newline at every block boundary, so a reader
 * quoting an article got it hard-wrapped, with words split across the breaks.
 * Measured in Chrome before this existed: `un do\ncument traduit`. The line
 * boundary is a fact about this column at this width, not about the text, and
 * it has no business travelling to whoever is being quoted at.
 *
 * The rule is the one the breaker used: a line that ends mid-word rejoins the
 * next with nothing between them, any other line with the space the breaker
 * consumed. `null` means “not ours”—no computed line in the selection, or a
 * selection that also covers text outside one—and the caller then leaves the
 * clipboard alone rather than reassembling something it does not understand.
 */
export function copiedText(fragment: DocumentFragment): string | null {
  const lines = [...fragment.querySelectorAll(".kp-line")];
  if (lines.length === 0) return null;

  // Anything selected outside the lines—a heading, a paragraph the observer
  // has not reached—would be dropped by the join below, so refuse instead.
  const strip = (text: string) => text.replace(/\s+/gu, "");
  const inLines = lines.map((line) => line.textContent ?? "").join("");
  if (strip(fragment.textContent ?? "") !== strip(inLines)) return null;

  /*
   * Lines of one paragraph share a parent in the clone; two paragraphs give
   * two parents. Without that grouping, selecting two paragraphs produced one
   * run-on paragraph, which is a different text from the one on screen — the
   * line break is an accident of this column, but the paragraph break is the
   * author’s.
   */
  return groupByParagraph(lines)
    .map((paragraph) => joinLines(paragraph, (line) => line.textContent ?? ""))
    .join("\n\n");
}

/**
 * The same passage as markup, so a paste into a rich-text target keeps the
 * links and the emphasis the article carries. Without it, repairing the plain
 * text would have cost the reader everything the markup said — a poor trade
 * for a paragraph whose whole point is that its markup survives typesetting.
 */
export function copiedHtml(fragment: DocumentFragment): string | null {
  const lines = [...fragment.querySelectorAll(".kp-line")];
  if (lines.length === 0) return null;

  return groupByParagraph(lines)
    .map((paragraph) =>
      `<p>${joinLines(paragraph, (line) => line.innerHTML)}</p>`
    )
    .join("");
}

/** Lines that share a parent belong to the same paragraph, in document order. */
function groupByParagraph(lines: readonly Element[]): Element[][] {
  const groups: Element[][] = [];
  let parent: ParentNode | null = null;

  for (const line of lines) {
    if (line.parentNode !== parent) {
      groups.push([]);
      parent = line.parentNode;
    }
    groups[groups.length - 1]!.push(line);
  }
  return groups;
}

/**
 * The breaker’s own rule: nothing after a break inside a word, a space
 * otherwise. `data-word-break` and not `data-hyphen`—a line ending on a
 * hyphen the author wrote carries the first and not the second, and reading
 * the wrong one pasted `cross- company`.
 */
function joinLines(
  lines: readonly Element[],
  read: (line: Element) => string,
): string {
  return lines
    .map((line, i) => {
      const previous = lines[i - 1];
      if (!previous) return read(line);
      return (previous.hasAttribute("data-word-break") ? "" : " ") + read(line);
    })
    .join("");
}
