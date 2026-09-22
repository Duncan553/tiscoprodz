"use client";

import { useRef, type ElementType } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

/**
 * SPLIT TEXT — a headline whose words rise out of the line, one after another.
 *
 * THE MECHANISM: two nested spans per word.
 *
 *   .split__word   overflow: hidden        <- a slot the word hides inside
 *   .split__inner  translateY(100%) -> 0   <- the word itself, sliding up
 *
 * The outer span is a mask. The inner span starts one full line-height BELOW
 * it, which puts it outside the mask, which means it is invisible — no opacity
 * needed. Animating it to 0 slides it up into the slot. That is the whole trick,
 * and it is one transform per word.
 *
 * WHY 100% AND NOT PIXELS: `100%` of a transform resolves against the element's
 * OWN height, so it is always exactly one word-height regardless of font size or
 * viewport. A pixel value is correct at one breakpoint and wrong at the others.
 * It also means this component never measures anything, so it cannot be caught
 * by the font-loading trap (splitting before the webfont loads measures the
 * fallback font, then every word jumps when the real font swaps in).
 *
 * WHY WORDS AND NOT LETTERS: letters read as a typewriter and break kerning —
 * each letter becomes its own inline-block, so pair kerning between them is
 * dropped and the word visibly loosens. Words read as a voice. See the
 * "Animating words" section of the motion skill.
 *
 * ACCESSIBILITY, which is the part that is usually broken: splitting a sentence
 * into spans turns it into fragments for a screen reader. Two attributes fix it:
 * `aria-label` on the container holding the original string, and `aria-hidden`
 * on every piece. The reader then announces the sentence and ignores the spans.
 * The label comes from the `text` prop — never from reading the DOM back, since
 * the DOM is the thing we just took apart.
 */
export function SplitText({
  text,
  as: Tag = "h1",
  className = "",
  delay = 0,
  stagger = 0.055,
  className_word = "",
  style,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  /** Passed through for the --text-h1/h2 font-size custom properties. */
  style?: React.CSSProperties;
  /** Seconds before the first word moves — use to queue behind another element. */
  delay?: number;
  /** Seconds between words. 0.055 is the tuned default; see the motion skill. */
  stagger?: number;
  className_word?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  // Fires ONCE. A headline that un-reveals when you scroll back up looks like a
  // rendering bug, so this is deliberately not scroll-linked.
  const inView = useInView(ref, { once: true, amount: 0.4 });

  // Split on runs of whitespace. Collapsing them is safe because the rendered
  // spacing comes from the CSS gap, not from the source string's spaces.
  const words = text.trim().split(/\s+/);

  const MotionTag = motion[Tag as keyof typeof motion] as typeof motion.h1;

  // REDUCED MOTION: no translation and no stagger. A stagger IS movement, so
  // staggering a fade still breaks the promise. The whole line fades as one.
  if (reduced) {
    return (
      <MotionTag
        ref={ref as never}
        className={className}
        style={style}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : undefined}
        transition={{ duration: 0.3 }}
      >
        {text}
      </MotionTag>
    );
  }

  return (
    <Tag ref={ref} className={`split ${className}`} style={style} aria-label={text}>
      {words.map((word, i) => (
        // The mask. aria-hidden because the container's aria-label already
        // carries the real sentence.
        <span className="split__word" key={`${word}-${i}`} aria-hidden="true">
          <motion.span
            className={`split__inner ${className_word}`}
            initial={{ y: "100%" }}
            animate={inView ? { y: 0 } : undefined}
            transition={{
              duration: 0.7,
              // Each word waits one stagger step longer than the last. Total
              // time = words * stagger + duration; keep it under ~1.2s or the
              // sentence finishes arriving after you finished reading it.
              delay: delay + i * stagger,
              ease: [0.16, 1, 0.3, 1], // slow out, hard stop
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
