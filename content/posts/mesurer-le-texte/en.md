---
title: Measuring text without paying for the reflow
date: 2025-09-12
summary: Why getBoundingClientRect forces a synchronous layout, and what changes when you measure text off the DOM.
tags: [typographie, bun]
---

## The symptom

The profiler was not lying: on the page I had just shipped, Chrome blamed nearly
a third of the frame time on one innocent-looking line, a call to
`getBoundingClientRect`. I am a product owner by trade — a business analyst who
writes code, and can therefore check his own suspicions — and twenty years in
financial software have taught me to distrust innocent-looking lines: that is
where the costs sleep.

The mechanism is well documented, and we forget it anyway. That method must
return geometry that is exact at the moment of the call, while the rendering
engine works lazily: your style and DOM writes pile up in a queue. To answer
correctly, the browser has to flush that queue on the spot — recalculate styles,
then layout, synchronously, while your JavaScript waits. Read after every write,
in a loop over thirty menu entries, and you have what the literature calls
forced synchronous layout, repeated until it becomes layout thrashing: the whole
frame spent on recalculations nobody will ever see.

So the cost is not in the call itself, which takes microseconds. It is in what
the call forces: a full layout pass, at a moment you did not choose.

## Measuring without the DOM

There is another way, and it changes more than performance. Measuring text is,
at heart, a pure operation: a string, a typeface, a size, and a table of font
metrics. None of that needs an element. You prepare the string once, get its
width by arithmetic, cache the result — and you can test all of it outside the
browser, in an ordinary unit test suite.

The consequences are practical ones:

- No more invalidation: the measurement never touches the document, so it cannot
  dirty it.
- The answer exists before first paint: the page is born at the right size
  instead of correcting itself in front of the reader.
- The cost becomes visible: paid once, at preparation time, not on every read.

The honest price: you must measure with the real font, which means waiting for
it to load, and line breaking becomes your own problem. Real constraints — but
data constraints, and data can be tested.

## What I take from it

This site, written from Chengdu where I have been based for years, fits its hero
name and its navigation with [pretext](https://github.com/chenglou/pretext),
which prepares once and then does nothing but arithmetic. I recognise the
reconciliation reflex from my day job: a number produced synchronously by the
layout engine is a number whose cost is hidden elsewhere in the ledger. Measured
off the DOM, the same number becomes data again — reproducible, testable, and
paid for exactly once.
