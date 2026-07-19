/*
 * About-section orbs — four labelled circles (Experience, Education, Skills,
 * Hobbies) dropped at random inside the About text. The paragraphs are
 * re-laid-out with pretext so every line flows around the circles, exactly
 * like the pretext "editorial engine" demo, except these orbs sit still,
 * carry a label, and are real anchors: click one to jump to its section,
 * drag it to reshape the text (the layout recomputes each frame, DOM-free).
 *
 * Progressive enhancement over the pre-rendered paragraphs: a visually
 * hidden copy keeps the plain text available to screen readers and search,
 * and the caller falls back to the Knuth–Plass paragraphs when this fails.
 */

import {
  type LayoutCursor,
  layoutNextLine,
  layoutWithLines,
  measureNaturalWidth,
  type PreparedTextWithSegments,
  prepareWithSegments,
} from "@chenglou/pretext";
import { loadHyphenator } from "./linebreak.ts";
import { type Lang, translations } from "./translations.ts";

const ORB_H_PAD = 14;
const ORB_V_PAD = 4;
const EDGE_MARGIN = 4;
/** Pointer travel (px) below which a pointerdown→up on an orb counts as a click. */
const CLICK_TOLERANCE = 5;

type SectionKey = "experience" | "education" | "skills" | "hobbies";

type RGB = [number, number, number];

/**
 * Each orb's accent is a custom property of the CSS palette, read at layout
 * time; the fallbacks mirror the dark palette in [src/styles.css](src/styles.css)
 * for the day a property is renamed away.
 */
const ORB_DEFS: { key: SectionKey; cssVar: string; fallback: RGB }[] = [
  { key: "experience", cssVar: "--accent", fallback: [99, 102, 241] },
  { key: "education", cssVar: "--accent-2", fallback: [168, 85, 247] },
  { key: "skills", cssVar: "--ok", fallback: [34, 197, 94] },
  { key: "hobbies", cssVar: "--amber", fallback: [245, 158, 11] },
];

/** Parse a custom property's color (`#rgb`, `#rrggbb`, `rgb(…)`) into a triplet. */
function parseRgb(value: string): RGB | null {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
    const n = parseInt(full, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(text);
  if (rgb) return [Number(rgb[1]!), Number(rgb[2]!), Number(rgb[3]!)];
  return null;
}

type Interval = { left: number; right: number };

type Orb = {
  key: SectionKey;
  label: string;
  color: RGB;
  r: number;
  x: number;
  y: number;
};

type FlowLine = {
  x: number;
  y: number;
  text: string;
  slotWidth: number;
  width: number;
  wordSpacing: number;
};

/** Dragged positions survive theme switches and resizes (as fractions of the stage). */
let savedPositions: { lang: Lang; frac: { x: number; y: number }[] } | null =
  null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Horizontal interval a circle blocks within one line band, or null if clear. */
function circleIntervalForBand(
  cx: number,
  cy: number,
  r: number,
  bandTop: number,
  bandBottom: number,
): Interval | null {
  const top = bandTop - ORB_V_PAD;
  const bottom = bandBottom + ORB_V_PAD;
  if (top >= cy + r || bottom <= cy - r) return null;
  const minDy = cy >= top && cy <= bottom
    ? 0
    : cy < top
    ? top - cy
    : cy - bottom;
  if (minDy >= r) return null;
  const maxDx = Math.sqrt(r * r - minDy * minDy);
  return { left: cx - maxDx - ORB_H_PAD, right: cx + maxDx + ORB_H_PAD };
}

/** Subtract blocked intervals from [0, width]; keep slots wide enough for text. */
function carveSlots(
  width: number,
  blocked: Interval[],
  minSlotWidth: number,
): Interval[] {
  let slots: Interval[] = [{ left: 0, right: width }];
  for (const interval of blocked) {
    const next: Interval[] = [];
    for (const slot of slots) {
      if (interval.right <= slot.left || interval.left >= slot.right) {
        next.push(slot);
        continue;
      }
      if (interval.left > slot.left) {
        next.push({ left: slot.left, right: interval.left });
      }
      if (interval.right < slot.right) {
        next.push({ left: interval.right, right: slot.right });
      }
    }
    slots = next;
  }
  return slots.filter((slot) => slot.right - slot.left >= minSlotWidth);
}

function countSpaces(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === " ") count++;
  return count;
}

/** Scatter orbs inside the text block, biased away from one another. */
function placeRandomly(orbs: Orb[], width: number, height: number): void {
  const placed: Orb[] = [];
  for (const orb of orbs) {
    const xMin = orb.r + EDGE_MARGIN;
    const xMax = Math.max(xMin, width - orb.r - EDGE_MARGIN);
    const yMin = orb.r + EDGE_MARGIN;
    const yMax = Math.max(yMin, height - orb.r - EDGE_MARGIN);
    let bestX = xMin;
    let bestY = yMin;
    let bestGap = -Infinity;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = xMin + Math.random() * (xMax - xMin);
      const y = yMin + Math.random() * (yMax - yMin);
      let gap = Infinity;
      for (const other of placed) {
        gap = Math.min(
          gap,
          Math.hypot(x - other.x, y - other.y) - (orb.r + other.r),
        );
      }
      if (gap > bestGap) {
        bestGap = gap;
        bestX = x;
        bestY = y;
      }
      if (bestGap >= 12) break; // comfortably apart — good enough
    }
    orb.x = bestX;
    orb.y = bestY;
    placed.push(orb);
  }
}

/**
 * Replace the About paragraphs with orb-aware flowed lines. Resolves to false
 * when the section (or its text) isn't there, so the caller can keep the KP
 * layout. Async only for the lazily-imported hyphenation patterns, which are
 * awaited before any DOM work so the layout itself stays synchronous.
 */
export async function enhanceAboutOrbs(lang: Lang): Promise<boolean> {
  // Load patterns first: everything after this line runs in one sync pass.
  const hyphenate = await loadHyphenator(lang);

  // The page may have switched language while the patterns loaded; the enhance
  // pass for the new language owns the DOM now, so report handled and leave it.
  if (document.documentElement.dataset.lang !== lang) return true;

  const body = document
    .getElementById("about")
    ?.closest(".section")
    ?.querySelector<HTMLElement>(".section__body");
  if (!body) return false;

  const t = translations[lang];
  const paragraphTexts = [t.about.p1, t.about.p2, t.about.p3];

  let stage = body.querySelector<HTMLElement>(".about-stage");
  if (!stage) {
    const paragraphs = Array.from(body.querySelectorAll<HTMLElement>("p.kp"));
    const first = paragraphs[0];
    if (!first) return false;
    stage = document.createElement("div");
    stage.className = "about-stage";
    first.before(stage);
    paragraphs.forEach((p) => p.remove());
  }
  stage.replaceChildren();

  const width = stage.clientWidth;
  if (width <= 0) return false;

  const style = getComputedStyle(stage);
  const font =
    `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const fontSize = parseFloat(style.fontSize) || 16;
  const parsedLineHeight = parseFloat(style.lineHeight);
  const lineHeight = Number.isFinite(parsedLineHeight)
    ? parsedLineHeight
    : fontSize * 1.6;
  const paragraphGap = Math.round(lineHeight * 0.75);
  const canJustify = !lang.startsWith("zh");
  const maxStretchPerSpace = fontSize * 0.45;
  // Slots narrower than this are skipped rather than filled: with syllable
  // hyphenation a Latin slot only needs room for a syllable or short word,
  // and CJK wraps happily per character.
  const minSlotWidth = lang.startsWith("zh") ? fontSize * 3 : fontSize * 4;

  // Screen-reader copy of the paragraphs; the flowed lines below are decoration.
  for (const text of paragraphTexts) {
    const p = document.createElement("p");
    p.className = "sr-only";
    p.textContent = text;
    stage.appendChild(p);
  }
  const linesHost = document.createElement("div");
  linesHost.className = "about-lines";
  linesHost.setAttribute("aria-hidden", "true");
  stage.appendChild(linesHost);

  // Soft hyphens at syllable boundaries (hyphen's Liang patterns, like the KP
  // path): pretext breaks on them and paints the "-" itself, so narrow slots
  // beside an orb split words cleanly instead of chopping them mid-letter.
  const prepared: PreparedTextWithSegments[] = paragraphTexts.map((text) =>
    prepareWithSegments(hyphenate ? hyphenate(text) : text, font)
  );

  // Height of the plain text without obstacles: the field the orbs live in.
  let baseHeight = 0;
  prepared.forEach((para, index) => {
    baseHeight += layoutWithLines(para, width, lineHeight).height;
    if (index < prepared.length - 1) baseHeight += paragraphGap;
  });

  // Orb radius fits its label (measured with pretext, tracking included).
  const isNarrow = width < 480;
  const labelFontSize = isNarrow ? 9 : 10.5;
  const labelTracking = labelFontSize * 0.12;
  const rootStyle = getComputedStyle(document.documentElement);
  const mono = rootStyle.getPropertyValue("--font-mono").trim() ||
    "ui-monospace, monospace";
  const labelFont = `600 ${labelFontSize}px ${mono}`;

  const orbs: Orb[] = ORB_DEFS.map((def) => {
    const label = t.nav[def.key].toUpperCase();
    const labelWidth = measureNaturalWidth(
      prepareWithSegments(label, labelFont, { letterSpacing: labelTracking }),
    );
    const minR = isNarrow ? 34 : 44;
    const maxR = Math.max(minR, width / 2 - 8);
    const r = clamp(labelWidth / 2 + 14, minR, maxR);
    const color = parseRgb(rootStyle.getPropertyValue(def.cssVar)) ??
      def.fallback;
    return { key: def.key, label, color, r, x: 0, y: 0 };
  });

  const remembered = savedPositions !== null &&
      savedPositions.lang === lang &&
      savedPositions.frac.length === orbs.length
    ? savedPositions.frac
    : null;
  if (remembered) {
    orbs.forEach((orb, index) => {
      const frac = remembered[index]!;
      orb.x = clamp(
        frac.x * width,
        orb.r + EDGE_MARGIN,
        Math.max(orb.r + EDGE_MARGIN, width - orb.r - EDGE_MARGIN),
      );
      orb.y = clamp(
        frac.y * baseHeight,
        orb.r + EDGE_MARGIN,
        Math.max(orb.r + EDGE_MARGIN, baseHeight),
      );
    });
  } else {
    placeRandomly(orbs, width, baseHeight);
  }
  const saveFractions = (): void => {
    savedPositions = {
      lang,
      frac: orbs.map((orb) => ({
        x: orb.x / width,
        y: orb.y / Math.max(1, baseHeight),
      })),
    };
  };
  saveFractions();

  const orbEls = orbs.map((orb) => {
    const [red, green, blue] = orb.color;
    const el = document.createElement("a");
    el.className = "about-orb";
    el.href = `#${orb.key}`;
    el.draggable = false;
    el.textContent = orb.label;
    el.setAttribute("aria-label", t.nav[orb.key]);
    el.style.width = `${orb.r * 2}px`;
    el.style.height = `${orb.r * 2}px`;
    el.style.fontSize = `${labelFontSize}px`;
    el.style.letterSpacing = `${labelTracking}px`;
    el.style.background =
      `radial-gradient(circle at 35% 32%, rgba(${red},${green},${blue},0.30), rgba(${red},${green},${blue},0.10) 58%, rgba(${red},${green},${blue},0.03) 78%)`;
    el.style.borderColor = `rgba(${red},${green},${blue},0.5)`;
    el.style.boxShadow =
      `0 0 32px 4px rgba(${red},${green},${blue},0.16), inset 0 0 24px rgba(${red},${green},${blue},0.10)`;
    stage.appendChild(el);
    return el;
  });

  const linePool: HTMLSpanElement[] = [];
  function syncPool(count: number): void {
    while (linePool.length < count) {
      const span = document.createElement("span");
      span.className = "about-line";
      linesHost.appendChild(span);
      linePool.push(span);
    }
    for (let index = 0; index < linePool.length; index++) {
      linePool[index]!.style.display = index < count ? "" : "none";
    }
  }

  function relayout(): void {
    const lines: FlowLine[] = [];
    let lineTop = 0;

    for (let paraIndex = 0; paraIndex < prepared.length; paraIndex++) {
      const para = prepared[paraIndex]!;
      let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
      const paraStart = lines.length;
      let exhausted = false;
      let guard = 0;

      while (!exhausted && guard++ < 400) {
        const blocked: Interval[] = [];
        for (const orb of orbs) {
          const interval = circleIntervalForBand(
            orb.x,
            orb.y,
            orb.r,
            lineTop,
            lineTop + lineHeight,
          );
          if (interval) blocked.push(interval);
        }
        const slots = carveSlots(width, blocked, minSlotWidth);
        for (const slot of slots) {
          const slotWidth = slot.right - slot.left;
          const line = layoutNextLine(para, cursor, slotWidth);
          if (!line) {
            exhausted = true;
            break;
          }
          lines.push({
            x: slot.left,
            y: lineTop,
            text: line.text,
            slotWidth,
            width: line.width,
            wordSpacing: 0,
          });
          cursor = line.end;
        }
        lineTop += lineHeight;
      }

      // Justify by stretching spaces — every paragraph line but the last, and
      // never beyond what justified text stretches to; too-loose lines stay ragged.
      if (canJustify) {
        for (let index = paraStart; index < lines.length - 1; index++) {
          const line = lines[index]!;
          const spaces = countSpaces(line.text);
          const extra = line.slotWidth - line.width - 1;
          if (
            spaces >= 2 && extra > 0 && extra / spaces <= maxStretchPerSpace
          ) {
            line.wordSpacing = extra / spaces;
          }
        }
      }

      if (paraIndex < prepared.length - 1) lineTop += paragraphGap;
    }

    syncPool(lines.length);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!;
      const el = linePool[index]!;
      el.textContent = line.text;
      el.style.left = `${Math.round(line.x)}px`;
      el.style.top = `${Math.round(line.y)}px`;
      el.style.lineHeight = `${lineHeight}px`;
      el.style.wordSpacing = line.wordSpacing > 0
        ? `${line.wordSpacing}px`
        : "";
    }

    for (let index = 0; index < orbs.length; index++) {
      const orb = orbs[index]!;
      const el = orbEls[index]!;
      el.style.left = `${Math.round(orb.x - orb.r)}px`;
      el.style.top = `${Math.round(orb.y - orb.r)}px`;
    }

    let bottom = lineTop;
    for (const orb of orbs) bottom = Math.max(bottom, orb.y + orb.r);
    stage!.style.height = `${Math.ceil(bottom)}px`;
  }

  let raf = 0;
  const scheduleRelayout = (): void => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      relayout();
    });
  };

  orbs.forEach((orb, index) => {
    const el = orbEls[index]!;
    let drag: {
      pointerId: number;
      startX: number;
      startY: number;
      orbX: number;
      orbY: number;
      moved: boolean;
    } | null = null;
    let suppressClick = false;

    el.addEventListener("dragstart", (event) => event.preventDefault());
    el.addEventListener("click", (event) => {
      if (suppressClick) {
        event.preventDefault();
        suppressClick = false;
      }
    });
    el.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        orbX: orb.x,
        orbY: orb.y,
        moved: false,
      };
      el.setPointerCapture(event.pointerId);
      el.classList.add("is-dragging");
      event.preventDefault();
    });
    el.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (
        !drag.moved && dx * dx + dy * dy > CLICK_TOLERANCE * CLICK_TOLERANCE
      ) drag.moved = true;
      if (drag.moved) {
        orb.x = clamp(
          drag.orbX + dx,
          orb.r + EDGE_MARGIN,
          Math.max(orb.r + EDGE_MARGIN, width - orb.r - EDGE_MARGIN),
        );
        orb.y = clamp(
          drag.orbY + dy,
          orb.r + EDGE_MARGIN,
          Math.max(orb.r + EDGE_MARGIN, baseHeight),
        );
        scheduleRelayout();
      }
    });
    const endDrag = (event: PointerEvent, clickable: boolean): void => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.moved) {
        if (clickable) suppressClick = true;
        saveFractions();
      }
      drag = null;
      el.classList.remove("is-dragging");
    };
    el.addEventListener("pointerup", (event) => endDrag(event, true));
    el.addEventListener("pointercancel", (event) => endDrag(event, false));
  });

  relayout();
  return true;
}
