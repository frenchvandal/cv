/*
 * Dithered background engine — the Rust/WASM ordered-dithering renderer from
 * wasm/dither/ (compiled artifact committed at src/dither.wasm), driven here:
 * canvas sizing, RAF loop, theme flag, and the wipe transitions that
 * src/panels.ts uses between scenes.
 *
 * The canvas renders at the coarse cell grid (one ImageData pixel per dither
 * cell) and is upscaled by CSS with `image-rendering: pixelated`, which is
 * what makes the Bayer blocks visible. Progressive enhancement: if the wasm
 * fails to load or instantiate, the root gets a `dither-fallback` class and
 * CSS paints a plain gradient instead — the page never depends on the engine.
 */

import ditherUrl from "./dither.wasm";

type DitherExports = {
  memory: WebAssembly.Memory;
  init: (cols: number, rows: number, seed: number) => number;
  resize: (cols: number, rows: number) => number;
  render: (tMs: number, mode: number, blend: number, flags: number) => void;
  frame_ptr: () => number;
  frame_len: () => number;
};

// Keep in sync with wasm/dither/src/lib.rs.
const MODE_NEBULA = 0;
const MODE_WIPE = 1;
const MODE_STATIC = 2;
const FLAG_LIGHT = 1;
const MAX_COLS = 640;
const MAX_ROWS = 400;

/** CSS pixels covered by one dither cell — the chunkiness of the effect. */
const CELL_PX = 3;
/** Drifting clouds don't need 60 fps; 30 halves the CPU cost. */
const FRAME_MS = 1000 / 30;
/** One direction of a wipe (cover or reveal), in ms. */
const WIPE_MS = 300;

const SEED = 0x5f3759df;

let engine: DitherExports | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let cols = 0;
let rows = 0;
let imageData: ImageData | null = null;
let light = false;
let raf = 0;
let lastFrame = 0;
let wipeBlend: number | null = null;

function reducedMotion(): boolean {
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** (Re)size the cell grid to the viewport, clamped to the crate's arena. */
function sizeGrid(): void {
  if (!engine || !canvas || !ctx) return;
  let c = Math.ceil(globalThis.innerWidth / CELL_PX);
  let r = Math.ceil(globalThis.innerHeight / CELL_PX);
  if (c > MAX_COLS || r > MAX_ROWS) {
    const scale = Math.min(MAX_COLS / c, MAX_ROWS / r);
    c = Math.floor(c * scale);
    r = Math.floor(r * scale);
  }
  if (c === cols && r === rows) return;
  const ok = cols === 0 ? engine.init(c, r, SEED) : engine.resize(c, r);
  if (ok !== 0) return;
  cols = c;
  rows = r;
  canvas.width = c;
  canvas.height = r;
  imageData = ctx.createImageData(c, r);
}

function frame(t: number): void {
  raf = requestAnimationFrame(frame);
  if (t - lastFrame < FRAME_MS) return;
  lastFrame = t;
  if (!engine || !ctx || !imageData) return;

  const still = reducedMotion();
  const wiping = wipeBlend !== null;
  engine.render(
    still ? 0 : t,
    wiping ? MODE_WIPE : still ? MODE_STATIC : MODE_NEBULA,
    wipeBlend ?? 0,
    light ? FLAG_LIGHT : 0,
  );
  const src = new Uint8ClampedArray(
    engine.memory.buffer,
    engine.frame_ptr(),
    engine.frame_len(),
  );
  imageData.data.set(src);
  ctx.putImageData(imageData, 0, 0);

  // Under reduced motion one static frame is enough — stop the loop.
  if (still && !wiping) stop();
}

function start(): void {
  if (!raf) raf = requestAnimationFrame(frame);
}

function stop(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/**
 * Fetch the wasm bytes. Bun's file loader emits a chunk-relative string
 * (`./dither-hash.wasm`) but a bare `fetch()` resolves it against the DOCUMENT
 * — fine at a domain root, wrong under a sub-path deploy (the bundler's
 * `naming` puts the file in `assets/` but the string omits it). Resolving
 * against the chunk's own URL (`import.meta.url`, inside `assets/` in
 * production) is correct in every mode; the raw string is the fallback.
 */
async function fetchWasmBytes(url: string): Promise<ArrayBuffer> {
  const first = await fetch(new URL(url, import.meta.url));
  if (first.ok) return first.arrayBuffer();
  const retry = await fetch(url);
  if (!retry.ok) throw new Error(`dither.wasm: HTTP ${first.status}`);
  return retry.arrayBuffer();
}

/**
 * Load the wasm and attach the canvas. Resolves false (and arms the CSS
 * fallback) when anything fails — the site must never depend on the engine.
 * Idempotent.
 */
export async function initDither(): Promise<boolean> {
  if (engine) return true;
  try {
    const { instance } = await WebAssembly.instantiate(
      await fetchWasmBytes(ditherUrl),
      {},
    );
    engine = instance.exports as unknown as DitherExports;
  } catch (error) {
    console.info("[dither] wasm unavailable, CSS fallback", error);
    document.documentElement.classList.add("dither-fallback");
    return false;
  }

  canvas = document.createElement("canvas");
  canvas.className = "dither-canvas";
  canvas.setAttribute("aria-hidden", "true");
  ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    document.documentElement.classList.add("dither-fallback");
    return false;
  }
  // On <body>, NOT inside #app: a language switch re-renders #app's innerHTML
  // and would destroy the canvas with it.
  document.body.prepend(canvas);

  sizeGrid();
  start();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  globalThis.addEventListener("resize", sizeGrid, { passive: true });
  return true;
}

/** Follow the site theme; the next frame picks the inverted palette up. */
export function setDitherTheme(theme: "light" | "dark"): void {
  light = theme === "light";
  // Reduced motion stopped the loop after one frame — redraw once on toggle.
  if (engine && reducedMotion()) start();
}

/**
 * Bayer-sweep transition: the dither canvas rises above the page, covers the
 * screen cell by cell (blend 0→1), `swap` exchanges the content underneath,
 * then the sweep recedes. Instant (and wipe-less) when the engine is absent
 * or motion is reduced.
 */
export function wipeTransition(swap: () => void): void {
  if (!engine || reducedMotion() || wipeBlend !== null) {
    swap();
    return;
  }
  canvas?.classList.add("dither-canvas--wiping");
  start(); // a stopped static loop must run for the wipe

  const coverStart = performance.now();
  const cover = (now: number): void => {
    const p = Math.min((now - coverStart) / WIPE_MS, 1);
    wipeBlend = easeInOut(p);
    if (p < 1) {
      requestAnimationFrame(cover);
      return;
    }
    swap();
    const revealStart = performance.now();
    const reveal = (later: number): void => {
      const q = Math.min((later - revealStart) / WIPE_MS, 1);
      wipeBlend = 1 - easeInOut(q);
      if (q < 1) {
        requestAnimationFrame(reveal);
        return;
      }
      wipeBlend = null;
      canvas?.classList.remove("dither-canvas--wiping");
    };
    requestAnimationFrame(reveal);
  };
  requestAnimationFrame(cover);
}
