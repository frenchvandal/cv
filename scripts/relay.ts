/*
 * Relay pages for the pre-blog URLs.
 *
 * The new layout breaks every language URL the site used to have: `fr.html`
 * became `fr/`, and the English duplicate `en.html` is gone in favour of the
 * root alone. Those URLs have been shared and indexed, so they cannot simply
 * stop answering.
 *
 * Object storage cannot return a 301 without a rule configured on the CDN in
 * front of it, and this project’s whole deployment story is that `dist/`
 * uploads anywhere unchanged. A relay page is the only redirect that depends
 * on no host configuration at all: a canonical link naming the new location,
 * a zero-second refresh for browsers, and a clickable link for anyone the
 * refresh does not carry. They are `noindex`, so a crawler consolidates on the
 * canonical rather than keeping a thin duplicate, and they can be deleted once
 * the old URLs have aged out of the indexes.
 */

import { escapeHtml } from "../src/dom.ts";
import { LANGS } from "../src/translations.ts";
import { pagePath, type PageRef } from "../src/urls.ts";

/**
 * One relay page. The target lands in three attributes and one link, so it is
 * escaped once here rather than at each site — a `"` in it would break out of
 * all four at once.
 */
export function relayHtml(target: string, title: string): string {
  const href = escapeHtml(target);
  const name = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${href}" />
    <meta http-equiv="refresh" content="0; url=${href}" />
    <title>${name}</title>
  </head>
  <body>
    <p>This page has moved. <a href="${href}">Continue to ${name}</a>.</p>
  </body>
</html>
`;
}

/**
 * One relay per old language URL, `en.html` included — every page the flat
 * layout shipped except the root, which is still a real page and must not be
 * shadowed by a relay.
 */
export function relayPages(): { file: string; target: PageRef }[] {
  return LANGS.map((lang) => ({
    file: `${lang}.html`,
    target: { kind: "home", lang } as PageRef,
  }));
}

/**
 * The root-relative URL a relay points at.
 *
 * Indexes are published as directory URLs everywhere else on the site, so a
 * relay says `./fr/` and not `./fr/index.html`: two spellings of one page
 * would put a canonical in the relay that disagrees with the canonical on the
 * page it points to, which is exactly the duplicate the relay exists to avoid.
 */
export function relayTarget(target: PageRef): string {
  return `./${pagePath(target).replace(/(^|\/)index\.html$/, "$1")}`;
}
