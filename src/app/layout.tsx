import type { Metadata } from "next";
import { Inter, Archivo_Black } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Footer } from "@/components/Footer";
import { RouteBackdrop } from "@/components/RouteBackdrop";

/**
 * TWO FACES, TWO JOBS.
 *
 * The references are all editorial POSTERS — a huge, heavy, tightly-tracked
 * headline sitting on an image. That is a grotesque's job, not a serif's, so the
 * display face is Archivo Black: one weight, very heavy, with a narrow enough
 * set to run three words across a hero without shrinking them. Playfair was
 * elegant and wrong — a high-contrast serif goes thin and fussy at 6rem, which
 * is the opposite of what a poster headline needs.
 *
 * Inter stays for UI. It is unbeatable at 13px, which is exactly where a display
 * face with character starts hurting.
 *
 * `display: "swap"` paints text in a fallback immediately rather than leaving a
 * blank page while the font downloads — on Kenyan mobile data that gap is real.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Archivo_Black({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
  weight: "400", // Archivo Black ships a single weight — it IS the bold.
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
