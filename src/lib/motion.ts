/**
 * The shared motion vocabulary. Every animated component imports from here, so
 * the numbers live in one place instead of being retyped per component.
 *
 * The rules behind these values are in .claude/skills/motion/SKILL.md.
 */

/** Fast start, soft settle. Something appearing — it was already on its way. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
/** Accelerates away. Exits never linger. */
export const EASE_IN = [0.4, 0, 1, 1] as const;
/** Symmetric — starts and ends at rest. For A-to-B moves on screen. */
export const EASE_MOVE = [0.65, 0, 0.35, 1] as const;

export const DUR = {
  fast: 0.12,   // hover, focus, press
  small: 0.18,  // chip, badge, tooltip
  overlay: 0.26,
  /** The hero slide. A scene change, not a UI response — see the skill. */
  slide: 0.62,
} as const;

/**
 * The one entrance shape: 12px up + fade. Short travel on purpose — the eye
 * tracks DISTANCE, so a long slide feels slow at the same duration.
 *
 * `reduced` swaps the movement out for a plain fade. Motion animates in JS and
 * ignores the CSS `prefers-reduced-motion` block in globals.css entirely, so
 * every animated component has to handle it itself.
 */
export const rise = (reduced: boolean) => ({
  hidden: { opacity: 0, y: reduced ? 0 : 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: reduced ? 0 : DUR.small, ease: EASE_OUT },
  },
});

/**
 * Cascade for lists: 40ms apart. Capped in practice at ~8 items (320ms total) —
 * past that the last row is visibly waiting on the first, which is slowness with
 * extra steps.
 */
export const stagger = (reduced: boolean) => ({
  hidden: {},
  show: { transition: { staggerChildren: reduced ? 0 : 0.04 } },
});
