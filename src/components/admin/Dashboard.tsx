"use client";

import { useCallback, useEffect, useState } from "react";
import { UploadForm } from "@/components/admin/UploadForm";
import { UsagePanel } from "@/components/admin/UsagePanel";
import { EarningsPanel } from "@/components/admin/EarningsPanel";
import { PasswordPanel } from "@/components/admin/PasswordPanel";
import { LICENSES, LICENSE_ORDER, isAvailableFor, isPurchasable } from "@/lib/licenses";
import type { PromoState } from "@/lib/promo";

/** The admin's view of a beat row — includes drafts and the private keys. */
interface AdminBeat {
  id: string;
  title: string;
  bpm: number;
  musicalKey: string;
  genre: string;
  published: number;
  mp3Key: string;
  wavKey: string | null;
  stemsKey: string | null;
  createdAt: number;
}

export function Dashboard() {
  const [beats, setBeats] = useState<AdminBeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [promo, setPromo] = useState<PromoState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/beats");
    const data = (await res.json()) as { ok: boolean; beats?: AdminBeat[] };
    setBeats(data.beats || []);
    setLoading(false);
  }, []);

  const loadPromo = useCallback(async () => {
    const res = await fetch("/api/admin/promo");
    const data = (await res.json()) as { ok: boolean; promo?: PromoState };
    if (data.ok && data.promo) setPromo(data.promo);
  }, []);

  useEffect(() => { load(); loadPromo(); }, [load, loadPromo]);

  const togglePromo = async (bogo: boolean) => {
    // Optimistic, then reconciled from the response — a switch that waits a
    // round trip before moving feels broken.
    setPromo({ bogo });
    const res = await fetch("/api/admin/promo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bogo }),
    });
    const data = (await res.json()) as { ok: boolean; promo?: PromoState };
    if (data.ok && data.promo) {
      setPromo(data.promo);
      setNote(data.promo.bogo ? "Offer is live on the site." : "Offer switched off.");
    } else {
      // Put the switch back where it was rather than leaving it lying.
      setPromo({ bogo: !bogo });
      setNote("Could not change the offer.");
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/beats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; message?: string };
    // Say so when it did NOT work. The bug this avoids: a route that returns
    // success for an update that matched no rows, so the UI reports "Saved" over
    // a change that never happened. /api/admin/beats/[id] uses RETURNING for
    // exactly this reason.
    setNote(data.ok ? "Saved." : data.message || "That didn't save.");
    if (data.ok) load();
  };

  const destroy = async (id: string, title: string) => {
    // A real confirm, because this deletes the audio from R2 too and there is no
    // undo. window.confirm is crude and it is honest about the stakes.
    if (!window.confirm(`Delete "${title}" and its files? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/beats/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { ok: boolean; message?: string };
    setNote(data.ok ? "Deleted." : data.message || "Delete failed.");
    if (data.ok) load();
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 style={{ fontSize: "var(--text-h2)" }} className="font-display font-extrabold">Admin</h1>
        <button onClick={logout} className="btn btn-ghost">Sign out</button>
      </div>

      {/* ---- the offer ---------------------------------------------------- */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-lg">Buy one, get one free</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
              While this is on, every second licence <strong>of the same tier</strong> is
              free. Two MP3 licences means one is free; two WAV licences means one is
              free. An MP3 and a WAV don&apos;t pair — nobody buys one licence and is
              handed a different, cheaper one.
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--text-3)" }}>
              Applies across the whole catalogue, and takes effect immediately.
            </p>
          </div>

          <button
            role="switch"
            aria-checked={Boolean(promo?.bogo)}
            aria-label="Buy one get one free"
            disabled={promo === null}
            onClick={() => togglePromo(!promo?.bogo)}
            className="relative w-14 h-8 rounded-full shrink-0 cursor-pointer transition-colors disabled:opacity-40 tap-outset"
            style={{
              background: promo?.bogo ? "var(--accent)" : "var(--surface-2)",
              transitionDuration: "var(--dur-1)",
            }}
          >
            <span
              className="absolute top-1 w-6 h-6 rounded-full transition-all"
              style={{
                left: promo?.bogo ? "1.75rem" : "0.25rem",
                background: promo?.bogo ? "var(--on-accent)" : "var(--text-2)",
                transitionDuration: "var(--dur-1)",
              }}
            />
          </button>
        </div>

        {promo?.bogo && (
          <p className="text-sm mt-4 font-semibold" style={{ color: "var(--accent-hot)" }}>
            Live — buyers are seeing this now.
          </p>
        )}
      </div>

      <EarningsPanel />

      <PasswordPanel />

      <UsagePanel />

      <UploadForm onCreated={load} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg">Catalogue</h2>
          {note && <span className="text-xs" style={{ color: "var(--accent-hot)" }}>{note}</span>}
        </div>

        {loading ? (
          <p style={{ color: "var(--text-3)" }}>Loading…</p>
        ) : beats.length === 0 ? (
          <p style={{ color: "var(--text-3)" }}>Nothing uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {beats.map((b) => (
              <div key={b.id} className="card p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  {/* `truncate` clips to an ellipsis, which on a narrow phone
                      column can eat most of a beat name with no way to read it.
                      `title` gives it back on hover and long-press — the text is
                      still in the DOM for a screen reader either way. */}
                  <p className="font-display font-bold truncate" title={b.title}>
                    {b.title}
                    {!b.published && (
                      <span
                        className="ml-2 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "var(--accent-soft)", color: "var(--accent-hot)" }}
                      >
                        DRAFT
                      </span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    {b.genre} · {b.bpm} BPM · {b.musicalKey}
                  </p>
                  {/* Which tiers this beat can actually be sold at, derived from
                      the files present. This is the one place a missing WAV
                      becomes visible before a buyer notices it. */}
                  <p className="text-xs mt-1" style={{ color: "var(--text-2)" }}>
                    Sells as:{" "}
                    {LICENSE_ORDER.filter(
                      (id) =>
                        isAvailableFor(id, {
                          hasMp3: Boolean(b.mp3Key),
                          hasWav: Boolean(b.wavKey),
                          hasStems: Boolean(b.stemsKey),
                        }) || !isPurchasable(id)
                    )
                      .map((id) => LICENSES[id].name)
                      .join(", ")}
                  </p>
                </div>

                <button
                  onClick={() => patch(b.id, { published: b.published ? 0 : 1 })}
                  className={b.published ? "btn btn-ghost" : "btn"}
                >
                  {b.published ? "Unpublish" : "Publish"}
                </button>

                <button
                  onClick={() => destroy(b.id, b.title)}
                  className="btn btn-ghost"
                  style={{ color: "#f87171" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
