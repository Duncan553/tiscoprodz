"use client";

import { useEffect, useRef, useState } from "react";
import { DuotoneFilter } from "@/components/hero/Duotone";

/**
 * A FIXED VIDEO BACKDROP for an inner page.
 *
 * ABSOLUTE, not fixed — and the video inside it is STICKY. That combination is
 * doing something specific, so it is worth reading before changing it back.
 *
 * `fixed` is the obvious choice and it was the original one: the footage stays
 * put while the catalogue scrolls over it. But `fixed` covers the whole
 * VIEWPORT, and this element lives inside `.reveal-main`, which sits above the
 * fixed footer in the stack. So at the bottom of the page, where the page has
 * scrolled up to uncover the footer, this backdrop was still painting across
 * the full viewport — on top of the footer. The footer was present, on screen,
 * opacity 1 and hit-testable, and completely invisible.
 *
 * `absolute inset-0` bounds the backdrop to `.reveal-main`'s box, so it stops
 * exactly where the page content stops and can never reach the footer. The
 * video then uses `position: sticky` to get the viewport-locked look back:
 * sticky pins it to the top of the screen while scrolling THROUGH the parent,
 * and releases at the parent's end. Visually identical to fixed, but clipped.
 *
 * Everything is far more restrained than the hero. This sits behind a list
 * people are reading and comparing prices in — it is atmosphere, not the
 * subject. So: low opacity, a heavy scrim, and no ambient drift, because
 * movement behind a scannable list is what makes a page feel unreadable.
 *
 * `-z-10` and `pointer-events: none` keep it strictly behind and strictly
 * inert; nothing here can intercept a click on a beat row.
 */
export function PageBackdrop({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  // The `autoPlay` attribute alone is not enough — several browsers leave a
  // muted video loaded but paused. Calling play() explicitly is what starts it,
  // and the catch is required because a blocked autoplay REJECTS the promise.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => { /* blocked — the gradient below stands in */ });
  }, [src]);

  return (
    <div
      aria-hidden="true"
      className="page-backdrop absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        // `fixed` attachment paints this gradient against the VIEWPORT rather
        // than against this (now very tall) box — so it looks the same as it
        // did when the element itself was fixed, instead of being stretched
        // down the whole scroll height.
        backgroundAttachment: "fixed",
        // The same lit plane the hero falls back to. It is the floor of the
        // composition: if the video never paints, this is what shows, so the
        // page is never a flat slab of colour.
        background:
          "radial-gradient(90% 70% at 22% 8%, rgb(255 90 70 / 0.30), transparent 62%)," +
          "radial-gradient(70% 60% at 85% 95%, rgb(20 0 3 / 0.80), transparent 70%)," +
          "linear-gradient(155deg, #86182A 0%, #5A0F1E 48%, #330913 100%)",
      }}
    >
      <DuotoneFilter />

      {!failed && (
        <video
          ref={videoRef}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setFailed(true)}
          // sticky + h-screen is what replaces `fixed`: pinned to the top of
          // the viewport while you scroll through the parent, released at its
          // end. h-screen (not h-full) because the parent is now the height of
          // the whole page, and a video stretched to that is both wrong and
          // ruinous to decode.
          className="sticky top-0 w-full h-screen object-cover"
          style={{
            filter: "brightness(1.35) contrast(1.1) saturate(0.7) url(#tsc-duotone)",
            // Much lower than the hero. At full strength the footage competes
            // with the beat rows for attention, and the rows are the reason
            // anyone is on this page.
            opacity: 0.38,
          }}
        />
      )}

      {/* The scrim, heavier than the hero's. A catalogue is read top to bottom
          across its whole width, so unlike a headline there is no safe corner
          to leave clear. */}
      {/* The scrim rides with the video, so it is sticky and one viewport tall
          too. `-mt-[100vh]` pulls it back up over the video: both are in normal
          flow now (sticky participates in flow), so without it the scrim would
          sit one screen BELOW the footage instead of on top of it. */}
      <div
        className="sticky top-0 w-full h-screen -mt-[100vh]"
        style={{
          background:
            "linear-gradient(to bottom, rgb(28 1 6 / 0.62) 0%, rgb(28 1 6 / 0.78) 55%, rgb(28 1 6 / 0.90) 100%)",
        }}
      />
    </div>
  );
}
