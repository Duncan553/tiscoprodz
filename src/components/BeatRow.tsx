"use client";

import Link from "next/link";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useCartStore } from "@/stores/useCartStore";
import { LICENSE_ORDER, isAvailableFor } from "@/lib/licenses";
import type { PublicBeat } from "@/types/beat";
import { useEffect, useState } from "react";

/**
 * One beat as a LIST ROW — the catalogue format.
 *
 * Why a row and not a card grid, past a handful of beats:
 *
 * 1. Buying a beat is a COMPARISON, and comparison needs alignment. BPM, key and
 *    price sit in fixed columns (see .beat-row in globals.css), so your eye runs
 *    straight down one number. In a grid every value lands somewhere different.
 * 2. Bandwidth. The artwork is a 56px thumbnail, not a 300px cover, so a
 *    hundred-beat page pulls a fraction of the bytes.
 *
 * The right-hand column shows FORMATS, not price. Prices belong to the licence
 * tier and are identical for every beat, so a price column was the same number
 * repeated down the page. What differs per beat is which files exist — and that
 * is what decides which tiers are even on offer.
 */
export function BeatRow({ beat }: { beat: PublicBeat }) {
  const { beatId, isPlaying, play, pause } = usePlayerStore();
  const has = useCartStore((s) => s.has);
  const playingThis = beatId === beat.id && isPlaying;

  // Cart membership is a browser-only fact: reading it during the server render
  // produces HTML that disagrees with the first client paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const inCart = mounted && has(beat.id);

  /**
   * WHAT THIS BEAT CAN BE SOLD AS, not what it costs.
   *
   * Prices come from the licence TIER now, so every row in the catalogue showed
   * an identical "from $19.99" — the same number repeated down the page, which
   * is noise rather than information. The price moved to the page header where
   * it is stated once; this column carries the thing that actually DIFFERS
   * between beats: whether the WAV and the stems exist, which is what decides
   * the tiers on offer.
   */
  const formats: string[] = [
    beat.hasMp3 ? "MP3" : null,
    beat.hasWav ? "WAV" : null,
    beat.hasStems ? "STEMS" : null,
  ].filter((f): f is string => f !== null);
  const sellable = LICENSE_ORDER.some((id) => isAvailableFor(id, beat));

  return (
    <div className="beat-row card px-3 py-2.5 transition-colors">
      {/* Play first, because it is the first thing anyone does. 44px tap target. */}
      <button
        onClick={() => (playingThis ? pause() : play(beat.id, beat.previewUrl, beat.title, beat.coverUrl))}
        aria-label={playingThis ? `Pause ${beat.title}` : `Play ${beat.title}`}
        className="w-11 h-11 grid place-items-center rounded-full shrink-0 cursor-pointer transition-colors"
        style={{
          background: playingThis ? "var(--accent)" : "var(--surface-2)",
          color: playingThis ? "var(--on-accent)" : "var(--text-1)",
        }}
      >
        {playingThis ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      {/* Plain <img>, not next/image: the src is our own /api/media route, which
          already caches immutably at the edge. Next's optimizer would add a
          resize hop for a 56px thumbnail that is already small. */}
      <Link href={`/beats/${beat.id}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <img
          src={beat.coverUrl}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          className="w-12 h-12 md:w-14 md:h-14 rounded-lg object-cover"
          style={{ background: "var(--surface-2)" }}
        />
      </Link>

      {/* min-w-0 is what lets `truncate` fire: a grid item defaults to
          min-width:auto and refuses to shrink below its content. */}
      <Link href={`/beats/${beat.id}`} className="min-w-0">
        <p className="font-display font-bold text-[0.9375rem] truncate" style={{ color: "var(--text-1)" }}>
          {beat.title}
          {inCart && (
            <span className="ml-2 text-[10px] font-sans font-bold align-middle" style={{ color: "var(--accent-hot)" }}>
              IN CART
            </span>
          )}
        </p>
        <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-3)" }}>
          {beat.genre}
          {/* No BPM, key or format columns on a phone, so they fold in here
              rather than being dropped. */}
          <span className="md:hidden">
            {` · ${beat.bpm} BPM${beat.musicalKey ? ` · ${beat.musicalKey}` : ""}`}
            {formats.length > 0 && ` · ${formats.join("/")}`}
          </span>
        </p>
      </Link>

      {/* Tags, desktop only, capped at three. A row that wraps to two lines
          because a beat has nine tags breaks the scan rhythm of the whole list.
          The mask fades the cut so it reads as "there is more". */}
      <div
        className="hidden md:flex gap-1.5 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, #000 calc(100% - 24px), transparent)",
          WebkitMaskImage: "linear-gradient(to right, #000 calc(100% - 24px), transparent)",
        }}
      >
        {beat.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="chip">{tag}</span>
        ))}
      </div>

      <p className="hidden md:block text-sm tabular-nums" style={{ color: "var(--text-2)" }}>{beat.bpm} BPM</p>
      <p className="hidden md:block text-sm truncate" style={{ color: "var(--text-3)" }}>{beat.musicalKey || "—"}</p>

      {/* Price last and right-aligned: it is what people scan for, and a ragged
          price column is unreadable. */}
      {/* Desktop only. Three format chips plus the play button, artwork and
          title do not fit a 360px phone — the title would be squeezed to a few
          characters. On phone the formats fold into the meta line under the
          title instead, the same way BPM and key do. */}
      <div className="hidden md:flex items-center justify-end gap-1.5">
        {sellable ? (
          formats.map((f: string) => (
            <span
              key={f}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider"
              style={{
                // STEMS is the one worth spotting from across the page — it is
                // the difference between a $35.99 beat and a $120 one.
                background: f === "STEMS" ? "var(--accent-soft)" : "var(--surface-2)",
                color: f === "STEMS" ? "var(--accent-hot)" : "var(--text-3)",
              }}
            >
              {f}
            </span>
          ))
        ) : (
          <span className="text-xs" style={{ color: "var(--text-3)" }}>Enquire</span>
        )}
      </div>
    </div>
  );
}
