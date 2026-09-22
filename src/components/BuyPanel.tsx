"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCartStore } from "@/stores/useCartStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { formatUsd } from "@/lib/money";
import {
  LICENSES,
  LICENSE_ORDER,
  isAvailableFor,
  isPurchasable,
  copiesLabel,
  streamsLabel,
  formatsLabel,
  type LicenseId,
} from "@/lib/licenses";
import type { PublicBeat } from "@/types/beat";

/**
 * THE LICENCE PICKER — five tiers, straight from the licensing spec.
 *
 * Every number here is read from src/lib/licenses.ts, so the limits shown are
 * the limits sold and the price shown is the price charged. Nothing about a
 * tier is typed twice.
 *
 * Tiers this beat cannot serve are not rendered at all. Showing a greyed-out
 * Trackout on a beat with no stems invites the question "why not?" and the
 * answer is an internal detail — better that the option simply isn't there.
 */
function Tier({ beat, id }: { beat: PublicBeat; id: LicenseId }) {
  const { add, has } = useCartStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const license = LICENSES[id];
  const inCart = mounted && has(beat.id, id);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display font-bold text-[1.0625rem]" style={{ color: "var(--text-1)" }}>
            {license.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            {formatsLabel(id)}
          </p>
        </div>

        <div className="text-right shrink-0">
          {license.priceCents === null ? (
            <p className="text-sm font-semibold" style={{ color: "var(--accent-hot)" }}>
              Negotiation only
            </p>
          ) : (
            <p className="font-display font-bold text-xl tabular-nums" style={{ color: "var(--text-1)" }}>
              {formatUsd(license.priceCents)}
            </p>
          )}
        </div>
      </div>

      {/* The two limits that actually differ between tiers. The full rights
          breakdown lives on /licenses — repeating all six rows on every beat
          would bury the price, which is the thing being decided here. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
        <dt style={{ color: "var(--text-3)" }}>Distribution</dt>
        <dd className="text-right" style={{ color: "var(--text-1)" }}>{copiesLabel(id)}</dd>
        <dt style={{ color: "var(--text-3)" }}>Audio streams</dt>
        <dd className="text-right" style={{ color: "var(--text-1)" }}>{streamsLabel(id)}</dd>
      </dl>

      <div className="mt-4">
        {!isPurchasable(id) ? (
          // Exclusive is "Negotiation Only" in the spec, so it is an enquiry and
          // never an Add button. A mailto keeps it real without inventing a form
          // and a contact table nobody asked for.
          <a
            href={`mailto:tscoprodz@gmail.com?subject=${encodeURIComponent(`Exclusive licence — ${beat.title}`)}`}
            className="btn btn-ghost w-full"
          >
            Enquire about exclusive
          </a>
        ) : inCart ? (
          <Link href="/cart" className="btn btn-ghost w-full">In cart →</Link>
        ) : (
          <button onClick={() => add(beat, id)} className="btn w-full">
            Add — {formatUsd(license.priceCents!)}
          </button>
        )}
      </div>
    </div>
  );
}

export function BuyPanel({ beat }: { beat: PublicBeat }) {
  const { beatId, isPlaying, play, pause } = usePlayerStore();
  const playingThis = beatId === beat.id && isPlaying;

  // Exclusive is always offered — it needs no files from us, only a
  // conversation. Every other tier has to have its formats uploaded.
  const tiers = LICENSE_ORDER.filter((id) => isAvailableFor(id, beat) || !isPurchasable(id));

  return (
    <div className="space-y-3">
      <button
        onClick={() => (playingThis ? pause() : play(beat.id, beat.previewUrl, beat.title, beat.coverUrl))}
        className="btn w-full"
      >
        {playingThis ? "Pause preview" : "Play preview"}
      </button>

      {tiers.map((id) => (
        <Tier key={id} beat={beat} id={id} />
      ))}

      <p className="text-xs text-center pt-1">
        <Link href="/licenses" className="underline" style={{ color: "var(--accent-hot)" }}>
          Full usage terms for every licence
        </Link>
      </p>
    </div>
  );
}
