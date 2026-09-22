/**
 * THE BUILT-IN BACKGROUND, used whenever the file in `public/hero/` is absent.
 *
 * It is a BACKGROUND now, not a plate with a caption on it. The earlier version
 * centred its own large label, which made sense when it sat in a framed panel
 * beside the headline — behind a full-bleed headline it just competed with it,
 * two sets of big words on one screen.
 *
 * So this is lit architecture and NOTHING else: a raking light, a shaft, and
 * registration ticks. No caption, no place name, no label — a background that
 * narrates itself is filler, and filler is worse than plain.
 *
 * It exists so the landing page is never broken while art is being gathered.
 */
export function PlateGraphic() {
  return (
    <div
      className="w-full h-full relative"
      style={{
        // A raking light from the upper left plus a deep floor, so the frame
        // reads as a lit space rather than a flat fill. Same job a photograph
        // would do: give the headline something to sit in front of.
        background:
          "radial-gradient(90% 70% at 22% 8%, rgb(255 90 70 / 0.38), transparent 62%)," +
          "radial-gradient(70% 60% at 85% 95%, rgb(20 0 3 / 0.85), transparent 70%)," +
          "linear-gradient(155deg, #9E2233 0%, #6B1222 45%, #3F0A16 100%)",
      }}
      aria-hidden="true"
    >
      {/* A single hard light shaft. One diagonal band is most of what separates
          "lit space" from "gradient". */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(112deg, transparent 38%, rgb(255 255 255 / 0.10) 46%, rgb(255 255 255 / 0.02) 52%, transparent 58%)",
        }}
      />

      {/* Registration ticks, straight from the reference posters — they cost
          nothing and are most of what makes a plain panel read as designed. */}
      {[
        { top: 24, left: 24 },
        { top: 24, right: 24 },
        { bottom: 24, left: 24 },
        { bottom: 24, right: 24 },
      ].map((pos, i) => (
        <span key={i} className="absolute block" style={{ ...pos, width: 16, height: 16, opacity: 0.4 }}>
          <span className="absolute left-0 right-0 top-1/2 h-px" style={{ background: "#fff" }} />
          <span className="absolute top-0 bottom-0 left-1/2 w-px" style={{ background: "#fff" }} />
        </span>
      ))}

    </div>
  );
}
