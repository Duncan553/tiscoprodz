import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicBeat } from "@/lib/beats";
import { LICENSES, LICENSE_ORDER } from "@/lib/licenses";
import { env } from "@/lib/cf";
import { BuyPanel } from "@/components/BuyPanel";
import { SplitText } from "@/components/SplitText";

export const dynamic = "force-dynamic";

/**
 * A beat page is the only page on this site that can rank for a search someone
 * actually types — "ventures trap beat", "146 bpm d minor". So it gets its own
 * description built from its own facts instead of inheriting the site-wide one,
 * which was identical on all five beat pages and told a search engine nothing
 * about which was which.
 *
 * The cover art becomes the Open Graph image. That is the whole point of doing
 * this here rather than only in the layout: a link to a specific beat, pasted
 * into WhatsApp, should show THAT beat's artwork.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const beat = await getPublicBeat((await params).id);
  if (!beat) return { title: "Beat not found" };

  const site = env().SITE_URL || "https://tiscoprodz.tisco.workers.dev";
  const cheapest = LICENSES[LICENSE_ORDER[0]].priceCents;

  // Facts first, in the order a buyer scans them. No adjectives — a description
  // stuffed with "amazing premium fire" is what a spam page looks like.
  const bits = [beat.genre, `${beat.bpm} BPM`, beat.musicalKey].filter(Boolean);
  const description =
    `${beat.title} — ${bits.join(" · ")} instrumental by Tisco Prodz. ` +
    (cheapest ? `Licences from $${(cheapest / 100).toFixed(2)}. ` : "") +
    `Instant download, pay by card in USD.`;

  const cover = `${site}${beat.coverUrl}`;

  return {
    title: beat.title,
    description,
    alternates: { canonical: `/beats/${beat.id}` },
    openGraph: {
      type: "music.song",
      title: `${beat.title} — TISCOPRODZ`,
      description,
      url: `${site}/beats/${beat.id}`,
      images: [{ url: cover, width: 1200, height: 1200, alt: `${beat.title} cover art` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${beat.title} — TISCOPRODZ`,
      description,
      images: [cover],
    },
  };
}

export default async function BeatPage({ params }: { params: Promise<{ id: string }> }) {
  const beat = await getPublicBeat((await params).id);
  // getPublicBeat filters on published = 1, so an unpublished draft 404s here
  // exactly like a made-up id. A draft must not be reachable by knowing its URL.
  if (!beat) notFound();

  const site = env().SITE_URL || "https://tiscoprodz.tisco.workers.dev";
  const cheapest = LICENSES[LICENSE_ORDER[0]].priceCents;

  /**
   * STRUCTURED DATA. This is what lets a search result show the price and the
   * artwork instead of a plain blue link, and it is the only way a crawler
   * learns that this page sells something — nothing in the visible HTML says
   * "this is a product costing $19.99" in a form a machine can read.
   *
   * MusicRecording rather than Product, with the licence as the offer: the
   * thing on sale is a recording, and describing it accurately is also what
   * makes it eligible for music-specific results.
   *
   * Every value here comes from the database or the licence table. Inventing
   * ratings or review counts to win a star rating is exactly the kind of thing
   * that gets structured data penalised, and it would be a lie besides.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name: beat.title,
    byArtist: { "@type": "MusicGroup", name: "Tisco Prodz" },
    genre: beat.genre || undefined,
    url: `${site}/beats/${beat.id}`,
    image: `${site}${beat.coverUrl}`,
    audio: `${site}${beat.previewUrl}`,
    ...(cheapest
      ? {
          offers: {
            "@type": "Offer",
            price: (cheapest / 100).toFixed(2),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: `${site}/beats/${beat.id}`,
          },
        }
      : {}),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* JSON-LD must be a script tag, so dangerouslySetInnerHTML is the only
          way in. It is safe here because nothing in `jsonLd` is user input —
          every field comes from our own database and licence table — and
          JSON.stringify escapes the values regardless. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/beats" className="text-sm" style={{ color: "var(--text-3)" }}>
        ← Back to all beats
      </Link>

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8 mt-6 items-start">
        <img
          src={beat.coverUrl}
          alt={`${beat.title} cover art`}
          className="w-full aspect-square object-cover rounded-2xl border"
          style={{ borderColor: "var(--line)", background: "var(--surface-1)" }}
        />

        <div>
          <p className="eyebrow mb-2">{beat.genre}</p>
          {/* The beat title is data, so it is passed as a string — SplitText
              takes the text rather than children precisely so it can put the
              original, unsplit sentence in aria-label. */}
          <SplitText
            text={beat.title}
            as="h1"
            style={{ fontSize: "var(--text-h1)" }}
            className="font-display font-extrabold mb-3"
          />

          <div className="flex flex-wrap gap-2 mb-5">
            {[`${beat.bpm} BPM`, beat.musicalKey, ...beat.tags].filter(Boolean).map((chip) => (
              <span
                key={chip}
                className="px-2.5 py-1 rounded-full text-xs"
                style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
              >
                {chip}
              </span>
            ))}
          </div>

          <BuyPanel beat={beat} />

          <p className="text-xs mt-5 leading-relaxed" style={{ color: "var(--text-3)" }}>
            The preview is a tagged clip. What you download after paying is the clean,
            untagged file — delivered the moment the payment confirms. Charged in US
            dollars; your bank converts at its own rate.
          </p>
        </div>
      </div>
    </div>
  );
}
