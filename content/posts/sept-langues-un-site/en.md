---
title: Why this site speaks seven languages
date: 2025-10-03
summary: One static page per language, each written for its own readers, never a translation machine — lessons from twenty years in financial software and a Chengdu menu.
tags: [multilinguisme, web]
---

In twenty years of financial software — first as a business analyst, then as a
product owner — I have learned to distrust requirements that fit in one
sentence. "The site must be multilingual" is one of them. On the surface, a
checkbox. In truth, an architecture decision, an editorial stance, and a promise
made to the reader.

## One page per language

This site speaks seven languages: English, French, Portuguese, Spanish, and
three kinds of Chinese — 简体字 (simplified) for the mainland, 繁體字
(traditional) for Taiwan, plus a Hong Kong projection. Each language is a
complete static page, built ahead of time. There is no translation machine
between you and me: no translation API at load time, no JavaScript rewriting the
page while you read it. When you read the English version, every sentence was
written for you — not converted from French.

Why the insistence? Because I live in Chengdu, and Chinese handed me the best
metaphor of my career. At a restaurant I order 微辣 — "mildly spicy". The
dictionary agrees: mildly spicy. Literal, correct, and useless. Chengdu’s 微辣
is a local scale, a convention between the cook and the customer. Machine
translation renders the words and loses the convention, every single time.

## Language is part of the logic

I watched the same failure for two decades on banking projects: specifications
"translated" until the business rule fell out of them; screens where value date
became date de valeur when the market actually says date de valorisation. A
product’s language is not a coat of paint; it is part of its logic.

The technical design follows the editorial one. One page per language means no
shared state, no switch that leaves fragments of one language inside another,
clean SEO with hreflang, and language negotiation that happens only at the site
root. A URL that names a language is never redirected — a shared link must
remain the link that was shared.

The cost is real: every paragraph exists seven times, and I proofread it seven
times. That is the price of a simple promise — 微辣 means 微辣, and when this
site speaks to you in English, it does so natively, not in translation.
