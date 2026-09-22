"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { whatsappLink, instagramLink, mailtoLink } from "@/lib/site";
import {
  ContactIconLink,
  WhatsAppIcon,
  InstagramIcon,
  EmailIcon,
} from "@/components/ContactIcons";
import { usePlayerStore } from "@/stores/usePlayerStore";

/**
 * The footer, and the ONLY way into the admin area.
 *
 * There was no link to /admin anywhere on the site, so the producer had to know
 * to type the URL. A quiet "Producer" link here is the normal solution: the page
 * behind it is a password form either way, so the link costs nothing in security
 * and removes a piece of knowledge you shouldn't need to carry.
 *
 * MOTION — THE REVEAL. There are two layers to it and they do different jobs.
 *
 * 1. THE CURTAIN. This footer is `position: fixed` at the bottom of the
 *    viewport, BEHIND the page (see components/RevealLayout). It never moves.
 *    The page is an opaque sheet on top of it, and scrolling to the end slides
 *    that sheet up and uncovers the footer. There is no animation involved at
 *    all — the reveal is the scroll, which is why it tracks your finger exactly
 *    and costs nothing.
 *
 * 2. THE CONTENTS, which ARE scroll-linked. The rule draws across the top edge
 *    and the columns rise, and how far each one has got is a direct function of
 *    how much of the footer is currently uncovered. Scroll halfway into it and
 *    the motion sits halfway; scroll back up and it goes back. It is tied to
 *    the scroll position, not fired by it.
 *
 * WHY NOT useInView: that was the first version and it was silently broken. A
 * fixed element at the bottom of the viewport is ALWAYS intersecting, so the
 * observer fired the moment the page loaded — while the footer was still
 * completely hidden behind the page. Every animation played to completion
 * against the back of the sheet, and by the time you scrolled down there was
 * nothing left to watch. It looked like no animation had been written at all.
 *
 * The progress value is a plain scroll calculation rather than useScroll with
 * an element target, because the thing being measured is not this element's
 * position (it is fixed — it does not have one) but how far the PAGE has moved
 * off it.
 */
export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion() ?? false;

  // The player is fixed to the bottom of the viewport on top of this footer, so
  // while one is playing the footer's last row needs to get out from under it.
  // Only while one is playing: the player unmounts when nothing is, and padding
  // reserved for an element that is not there is just dead space at the bottom
  // of the page. (body used to carry `pb-28` for this unconditionally.)
  const playing = usePlayerStore((s) => s.beatId !== null);

  // 0 = fully covered by the page, 1 = fully uncovered.
  const raw = useMotionValue(0);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const h = el.offsetHeight;
      if (!h) return;
      // How many pixels of the footer are currently showing. The page is
      // `scrollHeight` tall and its last `h` pixels are the gap this footer
      // sits in, so the bottom edge of the viewport passing that point is
      // exactly the amount uncovered.
      const uncovered =
        window.scrollY + window.innerHeight -
        (document.documentElement.scrollHeight - h);
      raw.set(Math.min(1, Math.max(0, uncovered / h)));
    };

    update();
    // passive: this listener never calls preventDefault, and saying so lets the
    // browser scroll without waiting to find out.
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [raw]);

  // A spring on the progress value, not on each animation. Raw scroll input is
  // jittery on a trackpad and stepped on a mouse wheel; one spring here smooths
  // everything downstream from it at once.
  const progress = useSpring(raw, { stiffness: 140, damping: 26, mass: 0.4 });

  // Hoisted out of the JSX: useTransform is a hook, so writing
  // `reduced ? 1 : useTransform(...)` inline would call it conditionally and
  // break the rules of hooks the moment the preference changes.
  const ruleScale = useTransform(progress, [0, 0.34], [0, 1]);

  return (
    <footer
      ref={ref}
      className="relative mt-10"
      // The clearance for the player, applied to the element that is actually
      // underneath it.
      style={{ color: "var(--text-2)", paddingBottom: playing ? "7rem" : undefined }}
    >
      {/* The rule that draws itself. Absolutely positioned so it cannot affect
          layout while it animates. */}
      <motion.span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px origin-left"
        // Drawn by the scroll: the rule is fully across by the time a third of
        // the footer is showing, so it leads the columns rather than finishing
        // with them.
        style={{
          background: "var(--line-2)",
          scaleX: reduced ? 1 : ruleScale,
        }}
      />

      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-wrap items-start justify-between gap-8">
        <RevealCol progress={progress} index={0} reduced={reduced}>
          <p className="font-display text-lg tracking-tight">
            TISCO<span style={{ color: "var(--accent-hot)" }}>PRODZ</span>
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
            Beats licensed instantly. Priced in US dollars.
          </p>
        </RevealCol>

        <RevealCol progress={progress} index={1} reduced={reduced} as="nav" className="flex flex-col text-sm" ariaLabel="Site">
          <FooterLink href="/beats">All beats</FooterLink>
          <FooterLink href="/licenses">Licence terms</FooterLink>
          <FooterLink href="/about">Contact</FooterLink>
        </RevealCol>

        {/* Icons, not "WhatsApp 0711405010". The number, handle and address are
            in the hrefs where they belong and nowhere on screen — see
            components/ContactIcons for why. */}
        <RevealCol progress={progress} index={2} reduced={reduced} as="nav" className="flex items-center gap-2" ariaLabel="Contact">
          <ContactIconLink href={whatsappLink()} label="Message Tisco Prodz on WhatsApp" external>
            <WhatsAppIcon />
          </ContactIconLink>
          <ContactIconLink href={instagramLink} label="Tisco Prodz on Instagram" external>
            <InstagramIcon />
          </ContactIconLink>
          <ContactIconLink href={mailtoLink} label="Email Tisco Prodz">
            <EmailIcon />
          </ContactIconLink>
        </RevealCol>
      </div>

      <RevealCol
        progress={progress}
        index={3}
        reduced={reduced}
        className="max-w-6xl mx-auto px-4 py-4 border-t flex items-center justify-between gap-4 text-xs"
        style={{ borderColor: "var(--line)", color: "var(--text-3)" }}
      >
        <span className="py-3 inline-block">© {new Date().getFullYear()} Tisco Prodz</span>
        <Link href="/admin" className="footer-link tap inline-flex items-center px-1">
          Producer
        </Link>
      </RevealCol>
    </footer>
  );
}

/**
 * One block of the footer, revealed in step with the scroll.
 *
 * Each block starts 15% of the reveal after the one before it and takes 55% of
 * it to arrive, so they overlap rather than queue — the footer fills in as a
 * wave instead of four separate arrivals. Because the input is the scroll
 * position and not a timer, scrolling back up runs it backwards.
 *
 * Under `prefers-reduced-motion` the blocks are simply there: no translation
 * and no scroll-linked opacity. A reveal that tracks the scroll is still
 * movement, and tying movement to scrolling is specifically what triggers
 * vestibular discomfort.
 */
function RevealCol({
  progress,
  index,
  reduced,
  as = "div",
  className,
  children,
  ariaLabel,
  style,
}: {
  progress: MotionValue<number>;
  index: number;
  reduced: boolean;
  as?: "div" | "nav";
  className?: string;
  children: React.ReactNode;
  /** Named explicitly rather than spreading HTMLAttributes: that spread
      collides with Motion's own drag handler signatures, which are typed for
      pointer events rather than React's DragEvent. */
  ariaLabel?: string;
  /** Static styles (colours, borders). Merged UNDER the animated opacity/y so
      a caller can never accidentally overwrite them. */
  style?: React.CSSProperties;
}) {
  const start = index * 0.15;
  const opacity = useTransform(progress, [start, start + 0.55], [0, 1]);
  const y = useTransform(progress, [start, start + 0.55], [26, 0]);

  const Tag = as === "nav" ? motion.nav : motion.div;

  return (
    <Tag
      className={className}
      style={reduced ? style : { ...style, opacity, y }}
      aria-label={ariaLabel}
    >
      {children}
    </Tag>
  );
}

/** A footer link whose underline draws in rather than toggling on. */
function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className = "footer-link tap inline-flex items-center";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
