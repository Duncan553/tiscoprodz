"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { CONTACT, whatsappLink, instagramLink, mailtoLink } from "@/lib/site";

/**
 * The footer, and the ONLY way into the admin area.
 *
 * There was no link to /admin anywhere on the site, so the producer had to know
 * to type the URL. A quiet "Producer" link here is the normal solution: the page
 * behind it is a password form either way, so the link costs nothing in security
 * and removes a piece of knowledge you shouldn't need to carry.
 *
 * MOTION. The footer is the end of the page, so it gets an arrival rather than
 * a decoration:
 *
 *   - A RULE DRAWS across the top edge, left to right, as the footer enters.
 *     scaleX from a left origin — transform only, so no layout, and it reads as
 *     the page being ruled off.
 *   - The three columns RISE in sequence, 90ms apart. Slower than the 40ms used
 *     for list rows on purpose: a footer is read as three blocks, not eighteen
 *     links, so the stagger should be per block.
 *   - Links draw an UNDERLINE on hover, again scaleX from the left rather than a
 *     border toggling on, which would jump.
 *
 * `once: true` — it plays the first time you reach the bottom and never again.
 * A footer you return to constantly must not re-animate; that is the most
 * common "AI website" tell there is.
 */
export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const reduced = useReducedMotion() ?? false;

  const col = (i: number) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 22 },
    animate: inView ? { opacity: 1, y: 0 } : undefined,
    transition: {
      duration: reduced ? 0.25 : 0.55,
      delay: reduced ? 0 : i * 0.09,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  });

  return (
    <footer ref={ref} className="relative mt-10" style={{ color: "var(--text-2)" }}>
      {/* The rule that draws itself. Absolutely positioned so it cannot affect
          layout while it animates. */}
      <motion.span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px origin-left"
        style={{ background: "var(--line-2)" }}
        initial={{ scaleX: 0 }}
        animate={inView ? { scaleX: 1 } : undefined}
        transition={{ duration: reduced ? 0.2 : 0.9, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-wrap items-start justify-between gap-8">
        <motion.div {...col(0)}>
          <p className="font-display text-lg tracking-tight">
            TISCO<span style={{ color: "var(--accent-hot)" }}>PRODZ</span>
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
            Beats licensed instantly. Priced in US dollars.
          </p>
        </motion.div>

        <motion.nav {...col(1)} className="flex flex-col text-sm" aria-label="Site">
          <FooterLink href="/beats">All beats</FooterLink>
          <FooterLink href="/licenses">Licence terms</FooterLink>
          <FooterLink href="/about">Contact</FooterLink>
        </motion.nav>

        <motion.nav {...col(2)} className="flex flex-col text-sm" aria-label="Contact">
          <FooterLink href={whatsappLink()} external>WhatsApp {CONTACT.whatsapp}</FooterLink>
          <FooterLink href={instagramLink} external>@{CONTACT.instagram}</FooterLink>
          <FooterLink href={mailtoLink}>{CONTACT.email}</FooterLink>
        </motion.nav>
      </div>

      <motion.div
        {...col(3)}
        className="max-w-6xl mx-auto px-4 py-4 border-t flex items-center justify-between gap-4 text-xs"
        style={{ borderColor: "var(--line)", color: "var(--text-3)" }}
      >
        <span className="py-3 inline-block">© {new Date().getFullYear()} Tisco Prodz</span>
        <Link href="/admin" className="footer-link py-3 px-1 inline-block">
          Producer
        </Link>
      </motion.div>
    </footer>
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
  const className = "footer-link py-3 inline-block";
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
