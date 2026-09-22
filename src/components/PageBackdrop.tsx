"use client";

import { useEffect, useRef, useState } from "react";
import { DuotoneFilter } from "@/components/hero/Duotone";

/**
 * A FIXED VIDEO BACKDROP for an inner page.
 *
 * Fixed, not absolute: the footage stays put while the catalogue scrolls over
 * it. An absolutely-positioned backdrop scrolls away and leaves the rest of a
 * long page bare, which looks like the video failed rather than like a design.
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
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
      style={{
        // The same lit plane the hero falls back to. It is the floor of the
        // composition: if the video never paints, this is what shows, so the
        // page is never a flat slab of colour.
        background:
          "radial-gradient(90% 70% at 22% 8%, rgb(255 90 70 / 0.30), transparent 62%)," +
          "radial-gradient(70% 60% at 85% 95%, rgb(20 0 3 / 0.80), transparent 70%)," +
          "linear-gradient(155deg, #a80418 0%, #6b0210 48%, #33010a 100%)",
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
          className="w-full h-full object-cover"
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
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgb(28 1 6 / 0.62) 0%, rgb(28 1 6 / 0.78) 55%, rgb(28 1 6 / 0.90) 100%)",
        }}
      />
    </div>
  );
}
