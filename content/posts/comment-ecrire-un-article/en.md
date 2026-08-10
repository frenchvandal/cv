---
title: How to write an article
date: 2026-08-09
summary: Why this site’s posts live as Markdown files on disk, how the build renders them with zero added dependencies, and the full how-to for writing one.
tags: [meta, web]
---

## Why Markdown on disk

The CV lives in `src/translations.ts`, next to the interface copy: one document,
hand-translated into seven languages, every string measured and fitted by code.
An article is the opposite — long-form prose, neither type-checked nor measured,
and more will keep coming. I don’t want the bundle to grow with every post, or a
typo to break the compiler. So content lives on disk, read by the build at
pre-render time. Code stays code; prose stays prose.

## The file system is the data

A post’s address has two segments: the folder is the slug, the file is the
language. `content/posts/comment-ecrire-un-article/en.md` is the page you are
reading; `fr.md` next to it is the French version. No mapping table, no
registry: translating a post means dropping a file next to the others; removing
a language means deleting a file. The rule — a post exists in one to n
languages, each index lists only what exists in it — cannot be violated by
omission. `shanghai-note` is the demonstration: it exists in Chinese and nowhere
else, so a Spanish reader never sees it in their index, and from the Chinese
page the switcher leads to each other language’s index rather than to a dead
link. This article, by contrast, exists in all seven.

## Rendering with no dependency

Rendering is `Bun.markdown`, Bun’s native GFM engine: the blog adds no rendering
dependency to a project that has only two in total. Two passes —
`Bun.markdown.html()` emits the HTML, then `HTMLRewriter` applies what it
doesn’t: heading anchors, `rel` on external links, scrollable tables, lazy
images, `lang` marking of Chinese runs.

## English at the root

English lives at the root, every other language in its folder: `/blog/…` here,
`/fr/blog/…` for the French version. Asset paths, computed from each page’s
depth, stay relative: `dist/` drops as-is behind any prefix, with nothing to
rebuild. Only the absolute SEO URLs get the domain, at deploy time.

## The guard, no more and no less

`Bun.markdown` lets raw HTML through. Blocking known tags one by one would be a
blocklist, open by construction; so the build applies a closed allowlist: only
the tags legitimate Markdown can produce get through, everything else is
rejected, known or not. No `on…` attribute passes. Every `href` or `src` must be
`http`, `https`, `mailto`, or relative, after entity decoding and stripping the
control characters that could disguise a `javascript:`; an unresolved entity is
rejected, because the browser would decode it.

What it does not guarantee: attributes that are neither event handlers nor URLs
pass unexamined. Not a general sanitizer, but a fence around what an article may
produce — and this article passes its own filter; that’s the point.

## The manual

Writing an article means creating one file:

```text
content/posts/<slug>/<lang>.md
```

The slug is lowercase letters, digits, and hyphens. Some names are reserved —
they already name a site file or folder: `assets`, `blog`, `cv`, `index`, `404`,
`robots`, `sitemap`, `feed`, `og-image`, plus the language codes. A post called
`fr` would shadow the language folder.

The frontmatter is YAML, and it is `Bun.YAML.parse` that reads it — the grammar
is Bun’s, so you write what you already write everywhere else. What the build
owns is the contract: `title` and `date` required, the rest optional, any
unknown or duplicated key rejected with the file’s name. A complete example:

```text
---
title: How to write an article
date: 2026-08-09
summary: What the article promises, in one sentence.
tags: [meta, web]
---
```

Field by field: `date` is a real `YYYY-MM-DD` date — February 31st is rejected;
a missing `summary` is derived from the text; `tags` takes the form `[a, b]`;
`draft: true` excludes the post unless `DRAFTS=1`; `updated` dates a revision.

To read the result at its real URL — the dev server doesn’t know the blog’s
URLs:

```bash
bun run preview           # builds, then serves at http://localhost:4173
PORT=8080 bun run preview # different port
DRAFTS=1 bun run preview  # drafts included
```

The fonts need no thought: pushing to `main` runs a workflow that re-subsets the
site’s Noto files and commits them. To see the article in its real type before
pushing:

```bash
bun run fonts:update
```

A glyph no subset carries renders as tofu, and the build refuses to emit a
`dist/` that does not cover one — so forgetting is a loud failure, never a
surprise on a reader’s screen.

Finally, the `zh-hk` rule: writing `zh-hant.md` is enough — the Hong Kong
version is projected from the Taiwan one by the site’s lexicon, and an explicit
`zh-hk.md` wins. The dry conventions live in `AGENTS.md`; this article is the
story, that file is the reference.
