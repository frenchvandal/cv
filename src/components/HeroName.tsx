/** @jsxImportSource react */
import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Renders the hero name and fits it to the available width using pretext.
 *
 * Rather than binary-searching the DOM (each probe forcing a reflow), we ask
 * pretext for the *natural* pixel width of each line at a fixed reference size,
 * then scale the font-size so the widest line fills the container. Recomputing
 * on resize is pure arithmetic on cached glyph metrics — no layout thrash.
 *
 * Measurement runs only in the browser (pretext relies on a canvas 2D context),
 * so the server render falls back to a fluid `clamp()` defined in CSS and this
 * component refines it after hydration.
 */

/** Font size, in px, at which pretext measures the natural line widths. */
const REFERENCE_PX = 100;
/** Fraction of the container width the name should occupy (leaves breathing room). */
const FILL_RATIO = 0.98;

export interface HeroNameProps {
  /** The name split into the lines it should render on, e.g. ['JORGE', 'PAULA PINHEIRO']. */
  lines: readonly string[];
  /** Clamp bounds for the resolved font size, in px. */
  minPx?: number;
  maxPx?: number;
}

// SSR runs `useLayoutEffect`? No — React warns; use the isomorphic variant.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function HeroName({ lines, minPx = 30, maxPx = 92 }: HeroNameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);
  const lastWidthRef = useRef(0);

  useIsomorphicLayoutEffect(() => {
    const heading = headingRef.current;
    if (heading === null) return;

    const fit = (available: number): void => {
      if (available <= 0) return;

      const style = getComputedStyle(heading);
      // Build a canvas-compatible font shorthand pinned to the reference size.
      const font = `${style.fontStyle} ${style.fontWeight} ${REFERENCE_PX}px ${style.fontFamily}`;

      let widest = 0;
      for (const line of lines) {
        const prepared = prepareWithSegments(line, font);
        widest = Math.max(widest, measureNaturalWidth(prepared));
      }
      if (widest <= 0) return;

      const scaled = (REFERENCE_PX * (available * FILL_RATIO)) / widest;
      setFontSize(Math.round(Math.min(maxPx, Math.max(minPx, scaled))));
    };

    // The heading is a block: its width tracks the container, not its (nowrap)
    // text, so reading `clientWidth` never feeds back into our font-size change.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? heading.clientWidth;
      if (Math.abs(width - lastWidthRef.current) < 0.5) return; // ignore height-only changes
      lastWidthRef.current = width;
      fit(width);
    });
    observer.observe(heading);

    lastWidthRef.current = heading.clientWidth;
    fit(heading.clientWidth);

    // Web fonts change glyph metrics when they swap in: re-fit once Mona Sans is
    // ready so pretext measures against the real (named) font, not the fallback.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) fit(heading.clientWidth);
    });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [lines, minPx, maxPx]);

  return (
    <h1
      ref={headingRef}
      className="hero__name"
      aria-label={lines.join(' ')}
      style={fontSize === null ? undefined : { fontSize: `${fontSize}px` }}
    >
      {lines.map((line, index) => (
        <span className="hero__name-line" aria-hidden="true" key={index}>
          {line}
        </span>
      ))}
    </h1>
  );
}
