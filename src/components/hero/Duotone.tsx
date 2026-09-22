/**
 * THE DUOTONE FILTER — an SVG gradient map, which is how this is actually done.
 *
 * WHAT WAS WRONG BEFORE, and why it kept looking like a video in a box:
 *
 * CSS `filter: grayscale()` plus a red plate in `mix-blend-mode: color` does
 * not grade an image — it REPLACES its hue wholesale. Every tone collapses onto
 * one red, so a dark clip becomes a flat red field and a bright one becomes a
 * pink one. The footage is technically there and reads as a gradient.
 *
 * A gradient map is the real technique (the same thing as a Gradient Map
 * adjustment layer in Photoshop). It does two steps:
 *
 *   1. feColorMatrix — flatten to LUMINANCE, keeping the image's own light and
 *      shade, which is the information that makes a subject readable.
 *   2. feComponentTransfer — remap that single channel onto a two-colour RAMP.
 *      `tableValues="a b"` says: darkest pixel becomes `a`, brightest becomes
 *      `b`, everything between interpolates. Three of those, one per channel,
 *      IS the gradient.
 *
 * The ramp below runs from the page's own deepest red to a warm highlight, so
 * the footage's blacks land exactly on the background colour and its highlights
 * glow. Combined with `mix-blend-mode: screen` on the element (see globals.css),
 * those blacks then disappear into the page entirely — which is what removes
 * the rectangle and makes it read as one composition rather than a video
 * sitting on top of a colour.
 *
 * `color-interpolation-filters="sRGB"` is not optional. SVG filters default to
 * linearRGB, and the same ramp in linear space comes out visibly washed and
 * muddy — this one line is the difference between a rich grade and a grey one.
 */
export function DuotoneFilter() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      // Not display:none — Firefox and Safari have both, at various points,
      // refused to apply a filter defined inside a hidden subtree. Zero-sized
      // and positioned out of flow is the form that works everywhere.
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="tsc-duotone" colorInterpolationFilters="sRGB">
          {/* Rec. 709 luma weights, not a flat third each — green carries most
              of perceived brightness, and averaging the channels instead is why
              naive greyscale makes skin and shadow go muddy. */}
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0      0      0      1 0"
          />
          <feComponentTransfer>
            {/* THREE stops, not two. A two-stop ramp is a straight line from
                shadow to highlight, and on footage this dark almost everything
                lands near the shadow end. The middle stop lifts the mid-tones
                clear of the background so the subject actually separates.

                  shadow    -> #4d0712  just above the page, never below it
                  mid       -> #b3241f  the tone that carries the image
                  highlight -> #ffb492  warm, so highlights read as light */}
            <feFuncR type="table" tableValues="0.302 0.702 1.000" />
            <feFuncG type="table" tableValues="0.027 0.141 0.706" />
            <feFuncB type="table" tableValues="0.071 0.122 0.573" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
