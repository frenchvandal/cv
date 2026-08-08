import { expect, test } from "bun:test";
import { LANGS } from "../src/translations.ts";
import { relayHtml, relayPages, relayTarget } from "./relay.ts";

test("a relay page points, declares its canonical and refuses indexing", () => {
  const html = relayHtml("./fr/index.html", "Philippe Ribeiro");

  expect(html).toContain('<meta name="robots" content="noindex" />');
  expect(html).toContain('<link rel="canonical" href="./fr/index.html" />');
  expect(html).toContain(
    'http-equiv="refresh" content="0; url=./fr/index.html"',
  );
  expect(html).toContain('<a href="./fr/index.html">');
});

test("there is one relay per old language URL, and the root stays real", () => {
  const files = relayPages().map((p) => p.file);

  expect(files).toContain("en.html");
  for (const lang of LANGS.filter((l) => l !== "en")) {
    expect(files).toContain(`${lang}.html`);
  }
  expect(files).not.toContain("index.html");
});

test("each relay points at the home page of its language", () => {
  for (const { target } of relayPages()) {
    expect(relayTarget(target)).toMatch(/^\.\/([a-z-]+\/)?index\.html$/);
  }
});

test("a relay target is escaped", () => {
  expect(relayHtml('./x.html?a="b"', "T")).not.toContain('?a="b"');
});
