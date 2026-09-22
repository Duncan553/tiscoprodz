"use client";

import { useRef } from "react";
import { motion, useInView, useScroll, useTransform, useReducedMotion } from "motion/react";

/**
 * AMBIENT DRIFT — the hero's layers move BY THEMSELVES.
 *
 * This replaced a pointer-tracking parallax, and the reason is worth keeping:
 * a layer that follows the cursor is REACTIVE. It stops the instant someone
 * lifts their hand, and on a phone — where there is no cursor at all — it never
 * moves once. The page looked dead to most of the people visiting it.
 *
 * So every layer here runs its own infinite loop, with no input.
 *
 * THE FOUR THINGS THAT MAKE THIS LOOK ALIVE RATHER THAN WOBBLY (the full
 * reasoning is in .claude/skills/motion/SKILL.md, under Ambient motion):
 *
 *   1. LONG CYCLES — 9 to 17 seconds. Anything under about six reads as a pulse
 *      and drags the eye off the words.
 *   2. NO TWO PERIODS SYNC — 11s, 14s, 17s, 9s share no small factors, so the
 *      layers drift in and out of phase and never line up. 10/20/30 would
 *      re-converge every half minute and read as one pulse.
 *   3. MIRROR, NOT LOOP — `loop` snaps back to the start of every cycle, which
 *      is a visible jump. `mirror` reverses, so the motion never restarts.
 *   4. DIFFERENT AXES — one layer drifts sideways, one vertically, one breathes
 *      on scale, one tilts a fraction of a degree. All moving the same way looks
 *      like the page is sliding.
 *
 * Negative `delay` starts a loop part-way through, so the layers do not all
 * begin at the same extreme on page load.
 */

export interface DriftSpec {
  /** Seconds per cycle. Keep these mutually non-synchronising. */
  period: number;
  /** Pixels of horizontal travel. */
  x?: number;
  /** Pixels of vertical travel. */
  y?: number;
  /** Degrees of tilt. Fractions only — 0.4 is plenty. */
  rotate?: number;
  /** Scale reach, e.g. 0.02 breathes between 1 and 1.02. */
  scale?: number;
  /** How far this plane moves as the page scrolls past. 0 pins it. */
  scrollDepth?: number;
  /** Negative seconds: start the cycle already in progress. */
  phase?: number;
}

export function Drift({
  spec,
  className,
  style,
  children,
}: {
  spec: DriftSpec;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // `once: false` so it re-arms when the hero scrolls back into view. An
  // animation running off-screen burns battery for something nobody can see.
  const inView = useInView(ref, { once: false });
  const reduced = useReducedMotion() ?? false;

  // Autonomous, continuous, unprompted motion is exactly what the reduced-motion
  // setting is for — this is not the borderline case a pointer effect would be.
  // Cut hard rather than removing it, and never speed the cycle up to compensate.
  const amp = reduced ? 0.25 : 1;

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const scrollY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, -110 * (spec.scrollDepth ?? 0) * amp]
  );

  const x = spec.x ? [-spec.x * amp, spec.x * amp] : undefined;
  const y = spec.y ? [-spec.y * amp, spec.y * amp] : undefined;
  const rotate = spec.rotate ? [-spec.rotate * amp, spec.rotate * amp] : undefined;
  const scale = spec.scale ? [1, 1 + spec.scale * amp] : undefined;

  return (
    // TWO nested elements on purpose. The outer one owns the SCROLL transform,
    // the inner one owns the LOOP. Motion cannot drive the same property from a
    // motion value and a keyframe animation at once — putting both on one
    // element means whichever runs last silently wins, and the drift vanishes.
    <motion.div ref={ref} className={className} style={{ ...style, y: scrollY }}>
      <motion.div
        animate={inView ? { x, y, rotate, scale } : undefined}
        transition={{
          duration: spec.period,
          repeat: Infinity,
          repeatType: "mirror",
          // easeInOut, never linear: linear reads as a machine, and ambient
          // motion has to feel like it has weight.
          ease: "easeInOut",
          delay: spec.phase ?? 0,
        }}
        style={{ willChange: "transform" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
