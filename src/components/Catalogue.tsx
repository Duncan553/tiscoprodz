"use client";

import { useMemo, useState } from "react";
import { BeatRow } from "@/components/BeatRow";
import type { PublicBeat } from "@/types/beat";

/**
 * The catalogue list plus its search box.
 *
 * The beats arrive as a PROP from a server component that read D1 directly —
 * they are not fetched here. That's the shape worth noticing: the page is
 * rendered on Cloudflare with the database one binding away, so the browser gets
 * finished HTML and no loading spinner. jst-beat fetched the catalogue from the
 * client because Supabase was a separate service over the network; with D1 there
 * is no round trip to spend.
 *
 * Filtering stays client-side because it must be instant per keystroke, and the
 * whole list is already here.
 */
export function Catalogue({ beats }: { beats: PublicBeat[] }) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return beats;
    // EVERY word must appear somewhere, so "dark 140" narrows instead of
    // widening — which is what a two-word search is meant to do.
    const words = q.split(/\s+/);
    return beats.filter((b) => {
      const haystack = [b.title, b.genre, b.musicalKey, String(b.bpm), ...b.tags]
        .join(" ")
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [beats, query]);

  if (beats.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="font-display font-bold text-lg mb-1">No beats up yet</p>
        <p className="text-sm" style={{ color: "var(--text-2)" }}>
          New drops land here the moment they&apos;re published.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative max-w-sm mb-5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, genre, key, BPM, tag"
          aria-label="Search the catalogue"
          className="field pl-4 pr-9 rounded-full"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ color: "var(--text-3)" }}
          >
            ×
          </button>
        )}
        {/* aria-live so a screen reader hears the count change as you type. */}
        {query && (
          <p className="text-xs mt-2" aria-live="polite" style={{ color: "var(--text-3)" }}>
            {visible.length} of {beats.length} match
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          Nothing matches that.{" "}
          <button onClick={() => setQuery("")} className="underline cursor-pointer" style={{ color: "var(--accent-hot)" }}>
            Clear search
          </button>
        </p>
      ) : (
        <div className="space-y-2 stagger">
          {visible.map((beat) => (
            <BeatRow key={beat.id} beat={beat} />
          ))}
        </div>
      )}
    </>
  );
}
