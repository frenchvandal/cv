/*
 * Small helpers shared by the enhancement modules — each used to carry its own
 * copy. Keep this module free of top-level DOM access: scripts/build.ts imports
 * it transitively via src/render.ts and runs outside the browser, so everything
 * here must be safe to import (and call) only in a real document context.
 */

/**
 * Escape text for interpolation into HTML — element content AND quoted
 * attribute values. Content on this site is compile-time French/Chinese copy,
 * but every template interpolation goes through here so the rule has no
 * exceptions to audit.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Whether the user asked the OS for reduced motion. */
export function reducedMotion(): boolean {
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
}
