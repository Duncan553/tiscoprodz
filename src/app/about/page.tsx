import Link from "next/link";
import { CONTACT, whatsappLink, instagramLink, mailtoLink } from "@/lib/site";

/**
 * ABOUT / CONTACT.
 *
 * Deliberately short. Every fact on this page comes from src/lib/site.ts, which
 * carries tisco prodz's real details across from jst-beat — there is no invented
 * bio, no made-up credits, no "over 200 artists served". A producer's contact
 * page with fabricated history is worse than a bare one.
 *
 * If more belongs here, it should come from him, not from me.
 */
export const metadata = {
  title: "About",
  description: "Get in touch with Tisco Prodz about beats, licensing or custom work.",
};

const CHANNELS = [
  {
    label: "WhatsApp",
    value: CONTACT.whatsapp,
    href: whatsappLink("Hi Tisco — I found you through the site."),
    note: "Fastest for a custom beat or an exclusive.",
  },
  {
    label: "Email",
    value: CONTACT.email,
    href: mailtoLink,
    note: "Licensing questions and anything with attachments.",
  },
  {
    label: "Instagram",
    value: `@${CONTACT.instagram}`,
    href: instagramLink,
    note: "New drops and works in progress.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <p className="eyebrow mb-2">Tisco Prodz</p>
      <h1 style={{ fontSize: "var(--text-h1)" }} className="font-display font-extrabold mb-4">
        Get in touch
      </h1>
      <p className="mb-10 max-w-[58ch] text-lg" style={{ color: "var(--text-2)" }}>
        Every beat in the catalogue is licensed instantly — pick a tier, pay, and
        the files are on the next screen. For an exclusive, a custom beat, or
        anything the licence tiers don&apos;t cover, reach me directly.
      </p>

      <div className="space-y-3">
        {CHANNELS.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target={c.href.startsWith("http") ? "_blank" : undefined}
            rel={c.href.startsWith("http") ? "noreferrer" : undefined}
            className="card p-5 flex items-center justify-between gap-4 transition-colors"
          >
            <span className="min-w-0">
              <span className="block text-xs uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                {c.label}
              </span>
              <span className="block font-display font-bold text-lg truncate" style={{ color: "var(--text-1)" }}>
                {c.value}
              </span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                {c.note}
              </span>
            </span>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mt-10">
        <Link href="/beats" className="btn">Browse the beats</Link>
        <Link href="/licenses" className="btn btn-ghost">Read the licence terms</Link>
      </div>
    </div>
  );
}
