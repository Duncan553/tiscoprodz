"use client";

import { useEffect, useRef } from "react";

/**
 * THE FOOTER REVEAL — the footer is fixed BEHIND the page, and the content
 * slides up off it like a curtain being drawn back.
 *
 * HOW IT ACTUALLY WORKS (there is no scroll listener and no animation):
 *
 *   footer   position: fixed; bottom: 0; z-index: 0
 *   main     position: relative; z-index: 1; opaque background;
 *            margin-bottom: <footer height>
 *
 * The footer never moves. `main` is opaque and sits on top of it, so the footer
 * is simply covered — until the margin at the bottom of `main` scrolls past,
 * and the thing that was always there becomes visible. The "animation" is the
 * page scrolling. That is why it stays glued to the scroll position perfectly
 * and costs nothing: no rAF, no IntersectionObserver, no jank.
 *
 * THE STACKING PROBLEM, which is the only hard part:
 *
 * `main` has to be OPAQUE to hide the footer, but the video backdrop has to
 * show through on inner routes. Those look mutually exclusive.
 *
 * They are not, because of paint order. An element paints its own background
 * first, then children with negative z-index, then in-flow content, then
 * children with z-index >= 0. So the backdrop is rendered INSIDE main with
 * `z-index: 0`: it paints ABOVE main's opaque background, but because it lives
 * inside main's stacking context it can never paint above the footer, which is
 * outside it. Give the backdrop `z-index: -1` instead and it disappears behind
 * main's own background — that is the bug this comment exists to prevent.
 *
 * The footer's height is measured rather than hardcoded: it changes with the
 * viewport (the columns wrap on a phone), and a margin that does not match
 * leaves either a gap of dead page or a footer you can never fully reveal.
 */
export function RevealLayout({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer || !ref.current) return;

    const apply = () => {
      const h = footer.getBoundingClientRect().height;
      // Written to the element rather than a stylesheet so it survives a
      // route change without a re-render.
      ref.current?.style.setProperty("margin-bottom", `${Math.round(h)}px`);
    };

    apply();
    // The footer reflows when the viewport changes — on a phone the three
    // columns stack and it roughly triples in height.
    const ro = new ResizeObserver(apply);
    ro.observe(footer);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <main ref={ref} className="reveal-main">
      {children}
    </main>
  );
}
