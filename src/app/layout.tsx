import type { Metadata } from "next";
import { Jost, Bodoni_Moda } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Footer } from "@/components/Footer";
import { RouteBackdrop } from "@/components/RouteBackdrop";

/**
 * A LUXURY PAIRING. Two faces, two jobs.
 *
 * DISPLAY — Bodoni Moda. The didone is the luxury letterform: hairline serifs
 * against very heavy stems, which is the contrast every fashion house has used
 * for a century. Crucially it is available at weight 900, so it stays
 * authoritative at hero size instead of going thin and fussy the way a lighter
 * didone does. That was the trap with Playfair earlier — elegant at 24px,
 * weak at 6rem. Bodoni at 900 solves both.
 *
 * UI — Jost. A geometric sans in the Futura lineage: the typeface luxury brands
 * actually set their body copy and navigation in. Cleaner and more composed than
 * a workhorse UI face, and still legible at 13px, which is where character
 * usually starts costing you.
 *
 * `display: "swap"` paints text in a fallback immediately rather than leaving a
 * blank page while the font downloads — on Kenyan mobile data that gap is real.
 */
const inter = Jost({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const display = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
  // 700 and up only: a didone below 700 loses its stem weight at large sizes
  // and the hero stops reading as a headline.
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: { default: "TISCOPRODZ — Buy Beats Online", template: "%s — TISCOPRODZ" },
  description: "Original beats by Tisco Prodz. Instant download, pay by card in USD.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* pb-28: the player is fixed to the bottom of the viewport, so without
          padding here it covers the last row of every page. */}
      <body className={`${inter.variable} ${display.variable} pb-28`}>
        {/* Behind everything, on every route but the landing page — which has
            its own full-screen hero. See components/RouteBackdrop. */}
        <RouteBackdrop />
        <Header />
        <main className="relative z-10">{children}</main>
        <Footer />
        {/* Outside <main> and in the layout, so a preview keeps playing across
            navigation instead of being unmounted with the page. */}
        <AudioPlayer />
      </body>
    </html>
  );
}
