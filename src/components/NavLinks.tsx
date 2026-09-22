"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

const ROUTES = [
  { href: "/beats", label: "Beats" },
  { href: "/licenses", label: "Licences" },
  { href: "/about", label: "Contact" },
];

/**
 * THE NAV LINKS — every route visible, on every screen size.
 *
 * WHAT WAS WRONG: "Contact" was `hidden sm:inline-flex`, so on a phone the
 * contact route simply did not exist in the navigation. Measured at 375px, all
 * five items need 422px on one row — 47px more than there is. The old code
 * bought that space by deleting a route, which is the one thing you cannot do:
 * Contact is how a customer reaches the producer.
 *
 * WHAT IT DOES INSTEAD: the header wraps. On a phone the wordmark and the cart
 * take the first row, and these three links take the full width of a second row,
 * spread edge to edge. Nothing is behind a tap, nothing scrolls out of sight,
 * and there is no hamburger to open. From 640px up it is one row again.
 *
 * THE POP: two separate motions, and they are not the same thing.
 *
 *  - On mount, each link springs up 60ms after the one before it. That is
 *    decoration, and it runs once.
 *  - On press, the link scales to 0.94. That is FEEDBACK, and it is the more
 *    important of the two: a phone has no hover state, so without it there is
 *    no confirmation that a tap registered until the next page paints. On a slow
 *    connection that gap is where people tap a second time.
 *
 * A spring, not a duration, for the press: `stiffness: 400, damping: 17` gives a
 * slight overshoot coming back, which is what reads as "pop" rather than "fade".
 */
export function NavLinks() {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  return (
    // w-full on a phone so `justify-between` has room to spread the three links
    // across the second row. order-2 on sm+ puts them back before the cart.
    <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1 sm:gap-2 sm:order-2">
      {ROUTES.map((r, i) => {
        // A nested route counts as active: /beats/abc should still light "Beats".
        const active = pathname === r.href || pathname.startsWith(r.href + "/");
        return (
          <motion.div
            key={r.href}
            initial={reduced ? false : { opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 24,
              delay: reduced ? 0 : i * 0.06, // one beat apart, left to right
            }}
            // The press feedback. whileTap fires on touch as well as mouse.
            whileTap={reduced ? undefined : { scale: 0.94 }}
          >
            <Link
              href={r.href}
              // min-h-11 is 44px: the tap-target floor. px-3 on a phone would
              // overflow the row, so it drops to px-2 and relies on the height.
              className="nav-link px-2 sm:px-3 min-h-11 inline-flex items-center text-sm rounded-lg"
              style={{ color: active ? "var(--text-1)" : "var(--text-2)" }}
              // aria-current is how a screen reader learns which page it is on.
              // The colour change alone says nothing to anyone not looking.
              aria-current={active ? "page" : undefined}
            >
              {r.label}
              {active && (
                // layoutId makes Motion animate this underline BETWEEN links
                // instead of fading one out and another in — the bar slides to
                // the new route. It only works because every instance shares the
                // same id, so Motion treats them as one travelling element.
                <motion.span
                  layoutId="nav-active"
                  className="nav-link__bar"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
