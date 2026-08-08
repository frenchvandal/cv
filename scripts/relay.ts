/*
 * Relay pages for the pre-blog URLs.
 *
 * The new layout breaks every language URL the site used to have: `fr.html`
 * becomes `fr/`, and the English duplicate `en.html` is gone in favour of the
 * root alone. Object storage cannot answer a 301 without going through the
 * CDN, so the build emits one small page per old URL instead: a canonical
 * link to the new location, a zero-second refresh, and a clickable link for
 * readers without JS. They are marked noindex, and can be retired once the
 * old URLs have aged out.
 */

import { escapeHtml } from "../src/dom.ts";
import { LANGS } from "../src/translations.ts";
import { pagePath, type PageRef } from "../src/urls.ts";

/**
 * One relay page. Every dynamic string is escaped: the target lands in three
 * attributes and one link, and a `"` in it would break out of all four.
 */
export function relayHtml(target: string, title: string): string {
  const href = escapeHtml(target);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${href}" />
    <meta http-equiv="refresh" content="0; url=${href}" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <p>This page has moved. <a href="${href}">Continue to ${
    escapeHtml(title)
  }</a>.</p>
  </body>
</html>
`;
}

/**
 * One relay per old language URL, plus `en.html`—every page the old layout
 * shipped except the root, which stays a real page. Targets are relative to
 * the site root, where the relays are written.
 */
export function relayPages(): { file: string; target: PageRef }[] {
  return LANGS.map((lang) => ({
    file: `${lang}.html`,
    target: { kind: "home", lang } as PageRef,
  }));
}

/** The root-relative URL a relay points at (`./fr/index.html`). */
export function relayTarget(target: PageRef): string {
  return `./${pagePath(target)}`;
}
