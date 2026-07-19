/*
 * Scroll-jacked panel deck — the careers.kimi.com navigation model.
 *
 * Desktop viewports (>= 56rem) without prefers-reduced-motion get the deck:
 * the page stops scrolling, and wheel / swipe / arrow keys advance one
 * full-screen panel at a time, with the dither wipe (src/dither.ts) covering
 * the swap. Everywhere else the panels stay plain stacked sections and the
 * browser scrolls natively — the markup never changes, only the `.panels-on`
 * class on <html> does (all deck styling in styles.css hangs off it).
 *
 * Hash routing works both ways: `#skills` deep-links into the deck, and each
 * activation `replaceState`s the hash so the URL stays shareable. Orb clicks,
 * the skip-link, the brand and the dots are plain anchors — they all reach
 * here through `hashchange`, so navigation works even before any listener is
 * attached.
 *
 * `initPanels` re-runs after every language re-render: #app's innerHTML is
 * replaced wholesale, so the controller re-queries the panels and re-applies
 * the current scene. Global listeners are attached once.
 */

import { isLang, translations } from "./translations.ts";
import { reducedMotion } from "./dom.ts";
import { wipeTransition } from "./dither.ts";

export type PanelHooks = {
  /** Called when a panel becomes active (reveal animations, stat counters). */
  onActivate?: (panel: HTMLElement) => void;
};

const DESKTOP_QUERY = "(min-width: 56rem)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const WHEEL_THRESHOLD = 60;
/** Ignores trackpad inertia tails between two intentional scrolls. */
const WHEEL_QUIET_MS = 160;
const STEP_LOCK_MS = 900;
const SWIPE_MIN_PX = 48;
/** Roughly the wipe's full duration (cover + reveal in src/dither.ts). */
const ANIMATION_MS = 650;

let panels: HTMLElement[] = [];
let dots: HTMLAnchorElement[] = [];
let hint: HTMLElement | null = null;
let live: HTMLElement | null = null;
let hooks: PanelHooks = {};

let active = false;
let bound = false;
let current = 0;
let animating = false;
let wheelAccum = 0;
let wheelLast = 0;
let lockUntil = 0;
let touchY: number | null = null;

function desktop(): boolean {
  return typeof matchMedia === "function" && matchMedia(DESKTOP_QUERY).matches;
}

/** Announce the scene change for screen readers (wheel nav moves no focus). */
function announce(index: number): void {
  if (!live) return;
  const lang = document.documentElement.dataset.lang;
  const t = translations[isLang(lang) ? lang : "en"];
  const label = dots[index]?.getAttribute("aria-label") ?? "";
  live.textContent = t.ui.progressAnnouncement
    .replace("{current}", String(index + 1))
    .replace("{total}", String(panels.length))
    .replace("{label}", label);
}

/** The panel carrying this hash target (its own id, or a heading inside it). */
function panelIndexForHash(hash: string): number {
  const id = hash.replace(/^#/, "");
  if (!id) return -1;
  return panels.findIndex(
    (panel) =>
      panel.id === id || panel.querySelector(`#${CSS.escape(id)}`) !== null,
  );
}

/** Stable hash id for a panel: its own, or its heading's. */
function idForPanel(panel: HTMLElement): string {
  if (panel.id) return panel.id;
  return panel.querySelector("[id]")?.id ?? "";
}

/** Panels taller than the viewport scroll internally; the deck only advances
 * once the internal scroller sits at the edge the gesture would cross. */
function atScrollEdge(panel: HTMLElement, dy: number): boolean {
  if (panel.scrollHeight <= panel.clientHeight + 1) return true;
  if (dy < 0) return panel.scrollTop <= 0;
  return panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
}

/** True while `el` still has room to scroll in the gesture's direction. */
function canConsume(el: HTMLElement, dy: number): boolean {
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  const overflow = getComputedStyle(el).overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  if (dy < 0) return el.scrollTop > 0;
  return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
}

/** A nested scroller (e.g. the Dialogue terminal) between the gesture target
 * and the panel that should consume the gesture instead of the deck. */
function nestedScrollerConsumes(
  target: EventTarget | null,
  panel: HTMLElement,
  dy: number,
): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== panel) {
    if (el instanceof HTMLElement && canConsume(el, dy)) return true;
    el = el.parentElement;
  }
  return false;
}

function applyState(index: number, focus: boolean): void {
  const previous = panels[current];
  if (previous && previous !== panels[index]) {
    previous.classList.remove("is-active");
    previous.setAttribute("inert", "");
    previous.setAttribute("aria-hidden", "true");
  }
  current = index;
  const panel = panels[current]!;
  panel.classList.add("is-active");
  panel.removeAttribute("inert");
  panel.removeAttribute("aria-hidden");
  panel.scrollTop = 0;

  dots.forEach((dot, i) => {
    dot.classList.toggle("is-active", i === current);
    if (i === current) dot.setAttribute("aria-current", "true");
    else dot.removeAttribute("aria-current");
  });
  hint?.classList.toggle("is-hidden", current === panels.length - 1);

  const id = idForPanel(panel);
  if (id && location.hash !== `#${id}`) {
    history.replaceState(null, "", `#${id}`);
  }
  announce(current);
  hooks.onActivate?.(panel);

  if (focus) {
    panel.querySelector<HTMLElement>(".section__title, h1")?.focus({
      preventScroll: true,
    });
  }
}

function activate(
  index: number,
  opts: { focus?: boolean; instant?: boolean } = {},
): void {
  if (index < 0 || index >= panels.length) return;
  if (index === current && panels[current]?.classList.contains("is-active")) {
    if (opts.focus) applyState(index, true);
    return;
  }
  if (opts.instant) {
    applyState(index, opts.focus ?? false);
    return;
  }
  if (animating) return;
  animating = true;
  wipeTransition(() => applyState(index, opts.focus ?? false));
  setTimeout(() => {
    animating = false;
  }, ANIMATION_MS);
}

function step(delta: number, focus = false): void {
  if (!active || animating) return;
  const now = performance.now();
  if (now < lockUntil) return;
  const next = current + delta;
  if (next < 0 || next >= panels.length) return;
  lockUntil = now + STEP_LOCK_MS;
  activate(next, { focus });
}

function onWheel(event: WheelEvent): void {
  if (!active) return;
  const panel = panels[current];
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1;
  const dy = event.deltaY * unit;
  // A scrollable panel or nested scroller consumes the wheel at will.
  if (panel && !atScrollEdge(panel, dy)) return;
  if (panel && nestedScrollerConsumes(event.target, panel, dy)) return;
  event.preventDefault();

  const now = performance.now();
  if (now - wheelLast > WHEEL_QUIET_MS) wheelAccum = 0;
  wheelLast = now;
  wheelAccum += dy;
  if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
  const dir = wheelAccum > 0 ? 1 : -1;
  wheelAccum = 0;
  step(dir);
}

const KEY_DELTAS: Record<string, number> = {
  ArrowDown: 1,
  PageDown: 1,
  " ": 1,
  ArrowUp: -1,
  PageUp: -1,
};

function onKeydown(event: KeyboardEvent): void {
  if (!active) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable]")) return;
  // Space/Enter on a focused link or button stays a click, not a panel step.
  if (
    (event.key === " " || event.key === "Enter") &&
    target?.closest("a, button")
  ) return;

  if (event.key === "Home") {
    event.preventDefault();
    lockUntil = performance.now() + STEP_LOCK_MS;
    activate(0, { focus: true });
    return;
  }
  if (event.key === "End") {
    event.preventDefault();
    lockUntil = performance.now() + STEP_LOCK_MS;
    activate(panels.length - 1, { focus: true });
    return;
  }
  const delta = KEY_DELTAS[event.key];
  if (delta !== undefined) {
    // A focused nested scroller (Dialogue terminal) keeps native key scroll.
    const panel = panels[current];
    if (panel && target && nestedScrollerConsumes(target, panel, delta)) {
      return;
    }
    event.preventDefault();
    step(delta, true);
  }
}

function onTouchStart(event: TouchEvent): void {
  if (!active) return;
  // Orb drags are pointer gestures, never swipes (orbs have touch-action:none).
  if ((event.target as HTMLElement | null)?.closest(".about-orb")) {
    touchY = null;
    return;
  }
  touchY = event.touches[0]?.clientY ?? null;
}

function onTouchEnd(event: TouchEvent): void {
  if (!active || touchY === null) return;
  const startY = touchY;
  touchY = null;
  const y = event.changedTouches[0]?.clientY;
  if (y === undefined) return;
  const travel = startY - y; // positive = swipe up = next panel
  if (Math.abs(travel) < SWIPE_MIN_PX) return;
  const panel = panels[current];
  if (panel && !atScrollEdge(panel, travel)) return;
  // Touch target is the element the gesture started on — same nested-scroller
  // rule as the wheel (e.g. swiping inside the Dialogue terminal scrolls it).
  if (panel && nestedScrollerConsumes(event.target, panel, travel)) return;
  step(travel > 0 ? 1 : -1);
}

function onHashChange(): void {
  if (!active) return;
  const index = panelIndexForHash(location.hash);
  if (index >= 0 && index !== current) activate(index);
}

function enable(): void {
  active = true;
  document.documentElement.classList.add("panels-on");
  const index = panelIndexForHash(location.hash);
  activate(index >= 0 ? index : 0, { instant: true });
}

function disable(): void {
  active = false;
  document.documentElement.classList.remove("panels-on");
  for (const panel of panels) {
    panel.classList.remove("is-active");
    panel.removeAttribute("inert");
    panel.removeAttribute("aria-hidden");
  }
}

/** Enter/exit deck mode as the viewport or motion preference changes. */
function evaluate(): void {
  if (desktop() && !reducedMotion() && panels.length > 0) {
    if (!active) enable();
  } else if (active) {
    disable();
  }
}

/**
 * (Re)bind the deck to the current DOM. Returns whether deck mode is on, so
 * the caller knows scroll reveals are its job (native mode) or ours.
 */
export function initPanels(panelHooks: PanelHooks = {}): boolean {
  hooks = panelHooks;
  panels = Array.from(document.querySelectorAll<HTMLElement>(".panel"));
  dots = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("[data-dot]"),
  );
  hint = document.querySelector<HTMLElement>("[data-hint]");
  live = document.querySelector<HTMLElement>("[data-panel-live]");

  if (!bound) {
    bound = true;
    globalThis.addEventListener("wheel", onWheel, { passive: false });
    globalThis.addEventListener("keydown", onKeydown);
    globalThis.addEventListener("touchstart", onTouchStart, { passive: true });
    globalThis.addEventListener("touchend", onTouchEnd, { passive: true });
    globalThis.addEventListener("hashchange", onHashChange);
    matchMedia(DESKTOP_QUERY).addEventListener("change", evaluate);
    matchMedia(REDUCED_QUERY).addEventListener("change", evaluate);
  }

  if (active) {
    // Fresh DOM after a language re-render: re-apply the current scene.
    applyState(Math.min(current, panels.length - 1), false);
  }
  evaluate();
  return active;
}
