"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

/**
 * THE OVERSIZED FOOTER WORDMARK, revealed as it scrolls into view.
 *
 * Per-letter rather than one block, because the two read completely
 * differently: a whole word fading in is a page element appearing; letters
 * arriving in sequence reads as the page SIGNING OFF. That is the job of a
 * footer mark.
 *
 * `once: true` — it plays the first time the footer is reached and never again.
 * Re-animating on every scroll back is the single most common "AI website"
 * tell, and on a footer you return to constantly it would be maddening.
 *
 * 45ms apart, not the 40ms used for lists: the letters are enormous, so the eye
 * needs slightly longer to register each one before the next lands.
 */
export function FooterMark({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  // `amount: 0.3` waits until a third of the mark is visible. Firing the moment
  // one pixel enters means the animation is over before it can be seen.
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion() ?? false;

  const letters = text.split("");

  return (
    <p
      ref={ref}
      className="footer-mark"
      // The animation is decorative duplication of text that is already in the
      // footer, so it is announced once here and the letters are hidden from
      // assistive tech — otherwise a screen reader spells it out.
      aria-label={text}
    >
      {letters.map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          aria-hidden="true"
          className="inline-block"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em" }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{
            duration: reduced ? 0.2 : 0.5,
            delay: reduced ? 0 : i * 0.045,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{
            // Alternating tone gives the mark depth without a second colour —
            // the brand letters stay white, the rest sit back.
            color: i < 5 ? "var(--text-1)" : "var(--accent-hot)",
          }}
        >
          {ch}
        </motion.span>
      ))}
    </p>
  );
}
