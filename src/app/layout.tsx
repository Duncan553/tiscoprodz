import type { Metadata } from "next";
import { Jost, Bodoni_Moda } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Footer } from "@/components/Footer";
import { RouteBackdrop } from "@/components/RouteBackdrop";
import { RevealLayout } from "@/components/RevealLayout";

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

const SITE = process.env.SITE_URL || "https://tiscoprodz.tisco.workers.dev";

export const metadata: Metadata = {
  // metadataBase is what turns every relative image path below into the
  // ABSOLUTE url that Open Graph requires. Without it Next warns and social
  // platforms get a relative path they cannot fetch, so the preview silently
  // falls back to no image — which is the failure this whole block exists to
  // prevent.
  metadataBase: new URL(SITE),
  title: { default: "TISCOPRODZ — Buy Beats Online", template: "%s — TISCOPRODZ" },
  description: "Original beats by Tisco Prodz. Instant download, pay by card in USD.",

  // OPEN GRAPH. This is not a search-ranking feature — Google ignores it. It
  // decides what a link LOOKS LIKE when it is pasted into WhatsApp, Instagram,
  // Twitter or iMessage, which for a producer is the actual distribution
  // channel. Without these a shared beat link is a bare blue string; with them
  // it is a card with the artwork and the title.
  openGraph: {
    type: "website",
    siteName: "TISCOPRODZ",
    title: "TISCOPRODZ — Buy Beats Online",
    description: "Original beats by Tisco Prodz. Instant download, pay by card in USD.",
    url: SITE,
    locale: "en",
  },
  twitter: {
    // summary_large_image gives the wide card. The plain "summary" card crops
    // artwork to a small square, which wastes the one visual asset we have.
    card: "summary_large_image",
    title: "TISCOPRODZ — Buy Beats Online",
    description: "Original beats by Tisco Prodz. Instant download, pay by card in USD.",
  },
  // Tells a crawler which url is canonical when the same page is reachable by
  // more than one address (with/without www, query strings from ad links).
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* No pb-28 here any more. It reserved 112px at the bottom of EVERY page
          for the player — but the player only mounts while something is
          playing, so most of the time that was dead space. Worse, with the
          footer reveal it double-counted: the page already ends with a gap the
          exact height of the footer, so the padding pushed the content 112px
          clear of the footer's top edge and left a bright band between them.
          The footer clears the player itself now, and only when there is one. */}
      <body className={`${inter.variable} ${display.variable}`}>
        {/* The footer is fixed BEHIND everything; RevealLayout is the opaque
            sheet that slides up off it. The backdrop lives INSIDE that sheet so
            it can never paint over the footer — see RevealLayout for the paint
            order this depends on. */}
        <Footer />
        <RevealLayout>
          <RouteBackdrop />
          <Header />
          <div className="relative z-10">{children}</div>
        </RevealLayout>
        {/* Outside <main> and in the layout, so a preview keeps playing across
            navigation instead of being unmounted with the page. */}
        <AudioPlayer />
      </body>
    </html>
  );
}
