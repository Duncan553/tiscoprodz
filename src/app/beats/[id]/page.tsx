import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicBeat } from "@/lib/beats";
import { BuyPanel } from "@/components/BuyPanel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const beat = await getPublicBeat((await params).id);
  return { title: beat ? beat.title : "Beat not found" };
}

export default async function BeatPage({ params }: { params: Promise<{ id: string }> }) {
  const beat = await getPublicBeat((await params).id);
  // getPublicBeat filters on published = 1, so an unpublished draft 404s here
  // exactly like a made-up id. A draft must not be reachable by knowing its URL.
  if (!beat) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
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
          <h1 style={{ fontSize: "var(--text-h1)" }} className="font-display font-extrabold mb-3">
            {beat.title}
          </h1>

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
