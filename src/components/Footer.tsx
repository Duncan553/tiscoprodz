import Link from "next/link";
import { FooterMark } from "@/components/FooterMark";
import { CONTACT, whatsappLink, instagramLink, mailtoLink } from "@/lib/site";

/**
 * The footer, and the ONLY way into the admin area.
 *
 * There was no link to /admin anywhere on the site, so the producer had to know
 * to type the URL. A quiet "Producer" link here is the normal solution: the page
 * behind it is a password form either way, so the link costs nothing in
 * security and removes a piece of knowledge you shouldn't need to carry.
 */
export function Footer() {
  // mt-10, not mt-20. The landing page ended with a screen of empty red between
  // the last card and the footer — a gap that reads as a missing section rather
  // than as breathing room. (A JSX comment cannot sit here, outside the
  // returned element; it has to be a normal one.)
  return (
    <footer className="border-t mt-10 overflow-hidden" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-wrap items-start justify-between gap-8">
        <div>
          <p className="font-display font-extrabold text-lg tracking-tight">
            TISCO<span style={{ color: "var(--accent-hot)" }}>PRODZ</span>
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
            Beats licensed instantly. Priced in US dollars.
          </p>
        </div>

        <nav className="flex flex-col text-sm" aria-label="Site">
          <Link href="/beats" className="py-3 inline-block" style={{ color: "var(--text-2)" }}>All beats</Link>
          <Link href="/licenses" className="py-3 inline-block" style={{ color: "var(--text-2)" }}>Licence terms</Link>
          <Link href="/about" className="py-3 inline-block" style={{ color: "var(--text-2)" }}>Contact</Link>
        </nav>

        <nav className="flex flex-col text-sm" aria-label="Contact">
          <a href={whatsappLink()} target="_blank" rel="noreferrer" className="py-3 inline-block" style={{ color: "var(--text-2)" }}>
            WhatsApp {CONTACT.whatsapp}
          </a>
          <a href={instagramLink} target="_blank" rel="noreferrer" className="py-3 inline-block" style={{ color: "var(--text-2)" }}>
            @{CONTACT.instagram}
          </a>
          <a href={mailtoLink} className="py-3 inline-block" style={{ color: "var(--text-2)" }}>{CONTACT.email}</a>
        </nav>
      </div>

      {/* The oversized mark, cropped by the footer's overflow so it reads as the
          edge the page sits on rather than a very large heading. */}
      <div className="max-w-6xl mx-auto px-4 pt-6 select-none" aria-hidden="true">
        <FooterMark text="TISCOPRODZ" />
      </div>

      <div
        className="max-w-6xl mx-auto px-4 py-4 border-t flex items-center justify-between gap-4 text-xs"
        style={{ borderColor: "var(--line)", color: "var(--text-3)" }}
      >
        <span className="py-3 inline-block">© {new Date().getFullYear()} Tisco Prodz</span>
        <Link href="/admin" style={{ color: "var(--text-4)" }}>
          Producer
        </Link>
      </div>
    </footer>
  );
}
