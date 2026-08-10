/*
 * A relay is the only redirect that works on plain object storage, so it has
 * to carry all three mechanisms at once: the canonical a crawler consolidates
 * on, the refresh a browser follows, and the link a reader clicks when neither
 * fires. Missing one of the three is a silent half-redirect.
 */

import { expect, test } from "bun:test";
import { relayHtml, relayPages, relayTarget } from "./relay.ts";
import { LANGS } from "../src/translations.ts";

test("a relay redirects, declares its canonical and refuses indexing", () => {
  const html = relayHtml("./fr/", "Philippe Ribeiro");

  expect(html).toContain('<meta name="robots" content="noindex" />');
  expect(html).toContain('<link rel="canonical" href="./fr/" />');
  expect(html).toContain('http-equiv="refresh" content="0; url=./fr/"');
  expect(html).toContain('<a href="./fr/">');
});

test("there is one relay per old language URL, en.html included", () => {
  const files = relayPages().map((p) => p.file);

  expect(files).toContain("en.html");
  for (const lang of LANGS) expect(files).toContain(`${lang}.html`);
  expect(files).toHaveLength(LANGS.length);
});

/*
 * The root is a real page — the one that negotiates the visitor’s language.
 * A relay written over it would replace the site’s entry point with a
 * redirect to itself.
 */
test("no relay shadows the site root", () => {
  const files = relayPages().map((p) => p.file);

  expect(files).not.toContain("index.html");
  expect(files).not.toContain("");
});

/*
 * Indexes are published as directory URLs everywhere else, so a relay must
 * point at `./fr/` and not `./fr/index.html`: the second spelling would make
 * the relay’s canonical disagree with the canonical of the page it points to.
 */
test("a relay points at the directory URL, not the index file", () => {
  expect(relayTarget({ kind: "home", lang: "fr" })).toBe("./fr/");
  expect(relayTarget({ kind: "home", lang: "en" })).toBe("./");
  expect(relayTarget({ kind: "home", lang: "zh-hant" })).toBe("./zh-hant/");
});

test("the target is escaped everywhere it lands", () => {
  const html = relayHtml('./x.html?a="b"', 'Name "quoted"');

  expect(html).not.toContain('?a="b"');
  expect(html).toContain("&quot;");
  expect(html).not.toContain('<title>Name "quoted"</title>');
});
