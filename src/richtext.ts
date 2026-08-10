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

import type { Run } from "./linebreak.ts";

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
  lines: readonly { fragments: { text: string; run: number }[] }[],
  runs: readonly RichRun[],
): void {
  const doc = el.ownerDocument;
  const out = doc.createDocumentFragment();

  for (const line of lines) {
    const lineEl = doc.createElement("span");
    lineEl.className = "kp-line";

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
