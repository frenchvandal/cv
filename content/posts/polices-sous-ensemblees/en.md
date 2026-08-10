---
title: The English reader never pays for the Chinese glyphs
date: 2026-02-08
summary: Subsetting woff2 fonts and letting unicode-range split the bill — and why a little white box is an alarm bell, not a rendering bug.
tags: [typographie, performance]
---

## The invoice nobody read

Twenty years of financial software leave you with a reflex: when a cost appears
on no line of the report, it is still being paid — somewhere else, and
unknowingly. Web fonts were that kind of cost for years. You declared a full
family, the browser downloaded a multi-megabyte file, and everyone called it
good typography. Nobody read the invoice; it went through as page weight.

This site works differently. Every font is cut into woff2 subsets: each file
keeps only the glyphs the copy actually uses. Latin fits in a handful of
kilobytes; Chinese, by its nature, asks for more. The ballpark figures:

| Font         |   Script covered    |     Size |
| :----------- | :-----------------: | -------: |
| Noto Sans    |        Latin        |  ~ 14 kB |
| Noto Sans SC | Simplified Chinese  | ~ 130 kB |
| Noto Sans TC | Traditional Chinese | ~ 130 kB |
| Noto Sans HK |  Hong Kong Chinese  | ~ 135 kB |

## The browser does the allocation

The clause that makes the split honest is `unicode-range`, inside the
`@font-face` declaration. It says: this file only serves this range of
characters. The browser matches ranges against the text on the page and fetches
only what overlaps. The practical consequence: an English reader will never
download a single byte of Chinese. The CJK files sit ready on the server, but
for that reader they simply never leave it — a Latin page never touches those
ranges.

As a product owner who has sat through two decades of budget committees, this is
the model I have always argued for: cost allocation follows real usage, not
conceivable usage. You do not cross-charge the Chinese budget to a visitor from
London.

## Tofu is an alarm

Subsetting has a failure mode, and it is visible to the naked eye. If a
character slips into the copy without slipping into the subset, the browser has
nothing to draw: it falls back to the replacement glyph, the little hollow box
typographers call tofu — from the Japanese 豆腐, a block of bean curd. One
forgotten character, and your headline grows a white square.

Tofu, then, is not a rendering bug; it is a signal. The copy changed, the subset
did not. The answer is not a bigger file — that would be going back to the
opaque invoice — but a discipline: regenerate the subsets from the characters
actually present in the sources whenever the text changes, and let a test
confirm it.

## What I take from it

From Chengdu, where I live, this machinery reads like a well-kept ledger: every
visitor pays for what they read and nothing more, and any gap between text and
font is obvious at a glance. `unicode-range` is the allocation key; tofu is the
internal control that refuses to stay silent.
