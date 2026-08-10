---
title: Bun as a Static Site Generator
date: 2026-01-15
summary: Twenty years of financial-software build pipelines taught me to distrust dependencies. This site is produced by Bun.build, HTMLRewriter, and a small pre-render loop — nothing else.
tags: [bun, ssg]
---

Twenty years in financial software leaves you with habits. Mine is counting
dependencies before counting features. I have inherited too many build pipelines
where half the packages had lost their maintainer and nobody could remember why
they were there. When I rebuilt my online CV, the rule was therefore fixed
before the first line of code: zero build dependencies. No Vite, no webpack, no
plugin kept alive by a stranger’s goodwill.

## Three capabilities, not one more

Bun makes that rule affordable. Three of its capabilities are enough to produce
the whole site.

The first is `Bun.build`, the native bundler. One entry point, one output
directory, minification: with a handful of options, TypeScript and CSS are
compiled and file names get their cache fingerprints. No configuration to tame,
no plugin graph to debug on a Friday night.

The second is `HTMLRewriter`, the HTML transformation API popularized by
Cloudflare Workers and implemented natively by Bun. It injects the SEO tags, the
`alternate`/`hreflang` links, and the language-negotiation script into the
document head — at build time, never at runtime.

The third is the most ordinary and the most decisive: Bun runs TypeScript
directly. My render function is pure — it returns a string and never touches the
DOM — so the build calls it once per language and writes the result with
`Bun.write`. Seven languages, eight pages: English serves as the root page and
also ships under its own name.

The heart of the pre-render is this loop:

```ts
import { renderApp } from "./src/render";
import { LANGS } from "./src/translations";

const result = await Bun.build({
  entrypoints: ["./src/main.ts", "./src/styles.css"],
  outdir: "./dist/assets",
  minify: true,
});
if (!result.success) throw new AggregateError(result.logs, "bundle failed");

for (const lang of LANGS) {
  const html = renderApp(lang); // pure string output, no DOM involved
  const page = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(
          `<link rel="alternate" hreflang="${lang}" href="./${lang}.html">`,
          { html: true },
        );
      },
    })
    .transform(html);
  const name = lang === "en" ? "index.html" : `${lang}.html`;
  await Bun.write(`dist/${name}`, page);
}
```

## The balance sheet, and the limits

As a product owner, what matters to me is not elegance but the balance sheet. A
full build in under a second on my laptop. A fully static `dist/` with relative
paths, deployable as-is to GitHub Pages or any host, under any base path. A CI
pipeline that installs nothing but Bun. And above all, a setup I can explain in
five minutes to a developer who has never seen the project — try that with a
2019 webpack config.

Honesty about the limits: Bun is neither Astro nor Eleventy. No collections, no
shortcodes, no theme ecosystem. Everything beyond its perimeter — sitemap, JSON
feeds, social metadata — is written by hand. That is exactly the contract I
signed: after two decades of rescuing systems nobody fully understood anymore, I
prefer a tool that does little, all of which I understand.

From Chengdu, where I live, the metaphor writes itself: it is the difference
between a kitchen full of gadgets and a good knife. The knife does not do
everything. But it never breaks down on a Friday night.
