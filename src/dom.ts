/*
 * Small helpers shared by the enhancement modules — each used to carry its own
 * copy. Keep this module free of top-level DOM access: scripts/build.ts imports
 * it transitively via src/render.ts and runs outside the browser, so everything
 * here must be safe to import (and call) only in a real document context.
 */

/**
 * Escape text for interpolation into HTML — element content AND quoted
 * attribute values. Content on this site is compile-time copy, never user
 * input, so nothing here is load-bearing against a real attacker; the rule
 * exists so the safe path is the habitual one and a future dynamic value
 * inherits it.
 *
 * The contract, precisely: **every interpolated value that is text** goes
 * through this function. Three things legitimately don't, and they are the
 * whole list to audit — markup already assembled from escaped parts (`links`,
 * `body`, `rows`…), identifiers drawn from closed unions (`lang`, `id`, the
 * `HTML_LANG`/`LANG_LABEL` records, class-name ternaries), and
 * [src/render.ts](src/render.ts)'s `pageTitle`, which returns a plain string
 * for `document.title` and `HTMLRewriter.setInnerContent` — both escape on
 * their own, and pre-escaping would double-encode the meta tags.
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
