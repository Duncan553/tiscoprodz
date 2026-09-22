"use client";

import { usePathname } from "next/navigation";
import { PageBackdrop } from "@/components/PageBackdrop";

/**
 * The site-wide video backdrop — on every route EXCEPT the landing page.
 *
 * The landing page is excluded because it already runs its own full-screen
 * hero: three slides, their own footage, their own ambient drift. Putting this
 * behind it would mean two videos decoding at once for no visual gain — the
 * hero covers the viewport anyway — and it would fight the slide transitions
 * in the strip of page below the fold.
 *
 * A route check rather than adding `<PageBackdrop />` to each page by hand, so
 * a new route gets the backdrop automatically and nobody has to remember. It is
 * a client component only because `usePathname` needs one; it renders a single
 * fixed div and nothing else, so it stays leaf-level and does not pull any page
 * out of server rendering.
 */
export function RouteBackdrop() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <PageBackdrop src="/hero/3.mp4" />;
}
