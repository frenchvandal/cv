---
title: Knuth–Plass in practice, and what the browser gets wrong about justification
date: 2025-11-21
summary: A practitioner’s notes on optimal paragraph breaking, hyphenation, and why the glue’s shrink has to be zero when CSS can only stretch spaces.
tags: [typographie, algorithmes]
---

I read long documents for a living — regulatory requirements, audit reports,
functional specifications. Twenty years as a product owner and business analyst
in financial software, the last several based in Chengdu, taught me that most
quality problems are optimization problems somebody framed too narrowly.
Paragraph justification in the browser is a small, perfect example.

What a browser does with `text-align: justify` is greedy: it fills one line at a
time, in order, and stops at the first word that no longer fits. Then it
stretches that line’s spaces out to the right margin. Each line is locally
acceptable, and the whole is a mess — a line full of gaping white sits above a
cramped one, and the reader’s eye stumbles at every return sweep.

Knuth and Plass published the alternative in 1981, for TeX: treat the paragraph
as a whole. The text becomes a sequence of boxes (the words), glue (the spaces,
which may stretch or shrink within declared bounds), and penalties (the
hyphenation points). The algorithm examines every feasible sequence of breaks
and keeps the one that minimizes the accumulated demerits of the entire
paragraph. A break that is mediocre for its own line can be the right one if it
unclogs the next three. The greedy one optimizes the quarter; the optimal one
optimizes the five-year plan.

Hyphenation is what gives the optimizer room to maneuver. Every syllable break
point — Liang patterns, in my case — is one more candidate position, which means
less forced stretching. Without hyphenation, optimal breaking still beats the
greedy one on Latin text, but narrow columns leave it with no cards to play.

The detail that took me longest to internalize is `shrink: 0`. In the TeX model,
glue can compress, because TeX genuinely renders compressed spaces. CSS cannot:
a browser widens interword space, it never narrows it. Let the solver use shrink
and it hands you solutions the rendering engine cannot honor — lines that were
supposed to fit end up overflowing. So you set shrink to zero, and the optimizer
proposes only what CSS can deliver. An implementation constraint pulled up into
the model, which is where constraints belong. After twenty years of writing
specifications, I wish more of them worked that way.

The exercise that convinced me: long paragraphs of continuous prose with almost
no markup — the most unforgiving case, and the most common one in my documents.
At equal column width, the greedy version shows visible holes; the optimal
version simply reads. That is all you should ever ask of infrastructure: that it
disappear.
