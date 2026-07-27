/*
 * Tight-wrapped chat bubbles, after pretext's "bubbles" demo
 * (http://chenglou.me/pretext/bubbles/).
 *
 * CSS wraps a bubble greedily at its max-width and then leaves the box as wide
 * as its widest line, so the last line often trails visual slack. For each
 * bubble we instead binary-search the smallest wrap width that keeps the line
 * count the max-width wrap produces, and set the bubble's width to that line's
 * real width — same break points, no wasted pixels.
 *
 * Pure progressive enhancement: the pre-rendered bubbles are plain max-width
 * boxes that look fine without JS; this only tightens them. Like every other
 * measurement on the site, it must run after `document.fonts.ready` and with
 * the page's named font stack (see [src/measure.ts](src/measure.ts)).
 */

import {
  layout,
  type PreparedTextWithSegments,
  prepareWithSegments,
  walkLineRanges,
} from "@chenglou/pretext";
import { fontSpecFrom } from "./measure.ts";

/**
 * Fallback bubble-to-chat ratio when `.msg` exposes no usable `max-width`.
 * The CSS rule is the source of truth; `bubbleMaxWidth` reads it from the
 * computed style.
 */
const BUBBLE_MAX_FALLBACK_RATIO = 0.8;

/** The CSS `max-width` of a bubble, in px — `%` resolves against the chat width. */
function bubbleMaxWidth(style: CSSStyleDeclaration, chatWidth: number): number {
  const raw = style.maxWidth;
  const value = parseFloat(raw);
  if (Number.isFinite(value) && value > 0) {
    return raw.endsWith("%")
      ? (chatWidth * value) / 100
      : Math.min(value, chatWidth);
  }
  return chatWidth * BUBBLE_MAX_FALLBACK_RATIO;
}

/**
 * prepareWithSegments is the expensive pass — cache it per font+text, as
 * bubbles re-tighten on every resize but their texts only change per language.
 * The tracking is keyed in too: it is measured into the widths, so two
 * trackings must never share a prepared text.
 */
const preparedCache = new Map<string, PreparedTextWithSegments>();

function prepared(
  text: string,
  font: string,
  letterSpacing: number,
): PreparedTextWithSegments {
  const key = `${letterSpacing} ${font}\u0000${text}`;
  let hit = preparedCache.get(key);
  if (!hit) {
    hit = prepareWithSegments(text, font, { letterSpacing });
    preparedCache.set(key, hit);
  }
  return hit;
}

type WrapMetrics = { lineCount: number; widestLine: number };

function wrapMetrics(
  p: PreparedTextWithSegments,
  maxWidth: number,
): WrapMetrics {
  let widestLine = 0;
  const lineCount = walkLineRanges(p, maxWidth, (line) => {
    if (line.width > widestLine) widestLine = line.width;
  });
  return { lineCount, widestLine };
}

/**
 * Width of the widest line under the smallest wrap width that still yields
 * the same line count as wrapping at `maxWidth` (the CSS behaviour).
 */
function tightWidth(p: PreparedTextWithSegments, maxWidth: number): number {
  const target = wrapMetrics(p, maxWidth).lineCount;
  let lo = 1;
  let hi = Math.max(1, Math.ceil(maxWidth));
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    // Only the line count matters here, so the lineHeight argument is moot.
    if (layout(p, mid, 1).lineCount <= target) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return wrapMetrics(p, lo).widestLine;
}

/** Tighten every `.msg` bubble of the dialogue section. Idempotent, resize-safe. */
export function enhanceChat(): void {
  const chat = document.querySelector<HTMLElement>(".chat");
  if (!chat) return;
  const bubbles = Array.from(chat.querySelectorAll<HTMLElement>(".msg"));
  const first = bubbles[0];
  if (!first) return;

  const chatWidth = chat.clientWidth;
  if (chatWidth <= 0) return;

  // All bubbles share one computed style; box-sizing is border-box, so the
  // horizontal padding and borders count into the width we set.
  const style = getComputedStyle(first);
  const { font, letterSpacing } = fontSpecFrom(style);
  const chromeH = (parseFloat(style.paddingLeft) || 0) +
    (parseFloat(style.paddingRight) || 0) +
    (parseFloat(style.borderLeftWidth) || 0) +
    (parseFloat(style.borderRightWidth) || 0);
  const bubbleMax = Math.floor(bubbleMaxWidth(style, chatWidth));
  const contentMax = bubbleMax - chromeH;
  if (contentMax <= 0) return;

  for (const bubble of bubbles) {
    const text = bubble.dataset.text ?? "";
    if (!text) continue;
    // +1px of slack: canvas-vs-DOM rounding must never wrap an extra line.
    const width =
      Math.ceil(tightWidth(prepared(text, font, letterSpacing), contentMax)) +
      chromeH + 1;
    bubble.style.width = `${Math.min(width, bubbleMax)}px`;
  }
}
