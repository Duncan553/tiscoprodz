"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/useCartStore";

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
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-display font-extrabold text-lg tracking-tight inline-flex items-center min-h-11 pr-2">
          TISCO<span style={{ color: "var(--accent-hot)" }}>PRODZ</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/beats" className="px-3 min-h-11 inline-flex items-center text-sm rounded-lg" style={{ color: "var(--text-2)" }}>
            Beats
          </Link>
          <Link href="/licenses" className="px-3 min-h-11 inline-flex items-center text-sm rounded-lg" style={{ color: "var(--text-2)" }}>
            Licences
          </Link>
          <Link href="/about" className="px-3 min-h-11 hidden sm:inline-flex items-center text-sm rounded-lg" style={{ color: "var(--text-2)" }}>
            Contact
          </Link>
          <Link
            href="/cart"
            className="relative px-3 min-h-11 inline-flex items-center text-sm rounded-lg font-semibold"
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
      </nav>
    </header>
  );
}
