"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/useCartStore";
import { NavLinks } from "@/components/NavLinks";

export function Header() {
  const lines = useCartStore((s) => s.lines);
  // The cart is in localStorage, so its count only exists in the browser.
  // Rendering it during SSR produces HTML that disagrees with the first client
  // paint, which React reports as a hydration error — so it waits for mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--surface-0) 88%, transparent)", borderColor: "var(--line)" }}
    >
      {/* flex-wrap, not a fixed h-16: on a phone the five items need 422px and
          there are 375, so the nav wraps onto a second row rather than dropping
          a route. `py-1` instead of a fixed height because the height is now two
          different things at two different widths. See components/NavLinks. */}
      <nav className="max-w-6xl mx-auto px-4 sm:h-16 flex flex-wrap items-center gap-x-2 sm:gap-x-4">
        {/* mr-auto pushes the cart to the far end of row one. */}
        <Link href="/" className="font-display font-extrabold text-lg tracking-tight inline-flex items-center min-h-11 pr-2 mr-auto">
          TISCO<span style={{ color: "var(--accent-hot)" }}>PRODZ</span>
        </Link>

        {/* The cart comes BEFORE the links in the DOM so that on a phone it
            lands on row one beside the wordmark. sm:order-3 puts it back after
            the links once everything fits on one line. */}
        <div className="flex items-center sm:order-3">
          <Link
            href="/cart"
            className="relative px-2 sm:px-3 min-h-11 inline-flex items-center text-sm rounded-lg font-semibold"
            style={{ color: "var(--text-1)" }}
          >
            Cart
            {mounted && lines.length > 0 && (
              <span
                className="absolute -top-1 -right-2 min-w-5 h-5 px-1.5 grid place-items-center rounded-full text-[11px] font-bold leading-none"
                // --accent became WHITE when the palette went pure red, and this
                // badge still hardcoded white text — so the count was invisible on
                // its own pill. Anything sitting on --accent must use --on-accent.
                style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              >
                {lines.length}
              </span>
            )}
          </Link>
        </div>

        <NavLinks />
      </nav>
    </header>
  );
}
