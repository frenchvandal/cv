---
title: Ten Years of Measuring Text in the Browser
date: 2026-07-30
summary: From getBoundingClientRect to off-DOM measurement — what a decade of web typography changed in my practice, and what never moved a pixel.
tags: [typographie, rétrospective]
---

Ten years ago I measured text in a browser for the first time in my career. The
requirement fit in one sentence: keep a trader’s name inside the header of a
positions screen, whatever its length, never truncated. The 2016 answer fit in
one line — a call to `getBoundingClientRect` — and over the years that single
line cost me more bug-hunting days than any pricing formula I ever shipped. This
retrospective runs from that line to the off-DOM measurements I use today, and
it tries to separate what ten years genuinely changed from what never moved a
pixel.

## The ruler lived in the document

Back then, measuring text was a ritual. You created an invisible `span`, parked
off-screen, injected the string, read its width, then removed the element before
anyone noticed. The gesture was so common that nobody questioned it: it was the
price of information the browser kept to itself.

I found the real cost the way everyone does, in a profiler.
`getBoundingClientRect` must answer accurately at call time, but the rendering
engine works lazily — your style and DOM writes pile up in a queue. To answer,
the browser flushes that queue on the spot: styles recalculated, layout
performed synchronously, while your JavaScript waits. One read after every
write, inside a loop over thirty menu entries, and the whole frame goes to
recalculations nobody will ever see. I am a product owner by trade — a business
analyst who writes his own code — and twenty years of financial software taught
me to distrust innocent-looking lines: that is where the costs sleep.

The worst of it was not performance. The worst was functional: the name
truncated in German, because a width measured in English says nothing about
"Geschäftsführer". Our typography bug reports read like an atlas.

## The canvas interlude

Around 2018 we thought we had found the exit: `measureText`, on a canvas
context. No DOM, no reflow, an answer in microseconds. We gained speed and lost
precision. The method returns advances, not a composition: no hyphenation, no
line wrapping, kerning that varies between engines, and a silent dependency on
font loading order. Measure too early and your text is measured in a fallback
font — and nobody notices until the demo.

I kept one lesson from that episode that goes beyond typography: a fast but
wrong measurement is worse than a slow one, because it inspires confidence. In
finance we would say it passes the controls.

## Measurement leaves the document

The real turn came later, when measuring stopped being a question asked of the
document and became a pure operation: a string, a font, a size, a metrics table.
Prepare the string once, get the widths by arithmetic, cache the result. The
document only enters the story to display an answer already known.

Three consequences changed my practice. The page is born at the right size
instead of correcting itself in front of the reader. Measurement becomes
testable outside the browser, in an ordinary suite — mine runs under Bun at
build time. And the cost is paid once, at preparation, legible in the ledger
instead of being hidden inside every read.

The constraints changed nature: you need the real font, so you wait for
`document.fonts.ready`; the line breaking becomes your own business. But these
are data constraints, and data can be tested. That is the contract I had been
waiting for since my first year in the industry.

## What never changed

Ten years, and the substance never moved. Measuring is still a typographic act,
not a technical feat. German still overflows, Chinese still ignores spaces, and
a badly placed break is still a fault of taste in the seven languages of this
site. Living in Chengdu puts Latin and Chinese text side by side in front of me
every day: I no longer need a bug report to know that the breaking rules differ
— I read it on restaurant menus.

One more constant: measurement is a contract with the reader. A truncated name
in a bank report is not a cosmetic defect, it is a breach of trust — like a
rounded amount nobody mentioned. That is why I still check these figures with my
own hands, with the same reflex I use in reconciliation: a figure produced
synchronously by the layout engine is a figure whose cost is hiding somewhere
else in the accounts.

## What I keep

The tools changed twice in ten years; the discipline, never. Measure with the
real font. Never trust a figure whose cost you have not seen. Pay once, at
preparation, and keep reading free. This site measures its title and navigation
with [pretext](https://github.com/chenglou/pretext), which prepares once and
then only does arithmetic: ten years after that first `getBoundingClientRect`,
the ruler no longer lives in the document. It lives in the data, where I should
have looked for it in 2016.
