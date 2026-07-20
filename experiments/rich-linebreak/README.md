# Run-aware Knuth–Plass (experiment)

**Status: proven, not adopted.** Nothing on the site imports this. It is kept
because the day a paragraph needs a link, a `<strong>`, or inline `code`, the
shipping line breaker cannot express it — and rediscovering that mid-task is
expensive.

## The problem it solves

[src/linebreak.ts](../../src/linebreak.ts) has the signature
`breakIntoLines(text, font, …) → string[]`. One font in, flat strings out. So a
paragraph containing inline markup is:

- **mis-measured** — every box is measured in the paragraph's font, so a bold or
  monospace span is charged the wrong width, and
- **erased** — `enhanceAboutKp` reads `p.textContent` and re-emits the result
  through `escapeHtml`, so the markup does not survive the round trip.

Measured in Chrome against the site's Noto Sans, on the line
`I led the cross-company rollout of single sign-on`:

| Inline style | Width error    | Note                                                                                        |
| ------------ | -------------- | ------------------------------------------------------------------------------------------- |
| italic       | **0px**        | Noto Sans has no true italic; the browser obliques the roman and the advances are unchanged |
| bold         | +5.9px (1.5%)  | against the 6px margin `enhanceAboutKp` keeps — right on the edge                           |
| monospace    | +31.2px (8.1%) | overflows outright                                                                          |

Concretely, in a 300px column with `<strong>evidence-based decisions</strong>`
mid-sentence:

```
=== measured per run (this fork) ===
  290px  ok       │ I led the cross-company roll-
  250px  ok       │ out of single sign-on and
  294px  ok       │ drove <strong>evidence-based de-</strong>
  284px  ok       │ <strong>cisions </strong>from user feedback
  260px  ok       │ across the whole platform.

=== measured flat (shipping behaviour) ===
  372px  OVERFLOW │ drove <strong>evidence-based decisions</strong>
```

The browser re-wraps that 372px line, which destroys the justification
Knuth–Plass just computed.

## What changed

Only the two ends of the pipeline. `buildItems` walks `Run[]` and carries a
`run` index on every box, measuring each in its own font; `toLines` returns
fragments instead of strings, coalescing consecutive boxes from the same run so
a line that crosses no style boundary still renders as one text node.

`optimalBreaks`, the demerit model and the glue invariants are **untouched** —
that is what makes the equivalence test below possible.

Hyphenation applies to single-run words only. A word straddling a run boundary
(`wo<strong>rd</strong>`) becomes consecutive boxes with no break between them:
splitting it would put the hyphen inside markup, and the case is rare enough
that the lost break opportunity costs nothing measurable.

## Tests

`bun test experiments/` — five tests, canvas-free via the injected measure:

1. every line fits the column when runs are measured in their own font
2. the styled run survives the round trip, intact and still marked
3. no text is lost or duplicated
4. measuring the bold run as regular overflows (the negative control)
5. **agrees with the shipping module, line for line, on flat text**

(5) is the one that keeps this honest. `breakIntoLinesFlat` is a compat shim
wrapping the run-aware core in the old flat contract, and the test asserts it
returns exactly what [src/linebreak.ts](../../src/linebreak.ts) returns across
four texts × five widths. If either side drifts, it fails here rather than at
adoption time.

## What adoption would cost

The public contract changes at both ends, so the callers move with it:

- [src/main.ts](../../src/main.ts) — `enhanceAboutKp` reads runs from the DOM
  instead of `textContent`, and emits elements instead of `escapeHtml`d text
- [src/render.ts](../../src/render.ts) — the About paragraphs become structured
  runs rather than plain strings
- [src/translations.ts](../../src/translations.ts) — copy that carries inline
  markup needs a shape for it

Roughly 250 lines including tests. Not worth doing until there is a paragraph
that actually needs it.

## Why not `@chenglou/pretext/rich-inline`

pretext ships a `rich-inline` module for exactly this shape of problem, and it
is the wrong tool here: it contains no Knuth–Plass.
`layoutNextRichInlineLineRange` fills a line up to `maxWidth` — greedy, like the
browser. Adopting it would give us rich text by replacing the optimal breaker
with the algorithm it exists to beat. It is the right choice for a caller that
has no line breaker yet; this project has a better one.
