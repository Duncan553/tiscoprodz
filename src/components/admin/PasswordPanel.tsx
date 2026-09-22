"use client";

import { useState } from "react";

/**
 * CHANGE THE ADMIN PASSWORD.
 *
 * Asks for the current one as well as the new one. The session cookie alone is
 * not enough on purpose: a logged-in browser left open should not be able to
 * change the credential and lock the owner out of his own catalogue.
 */
export function PasswordPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; kind: "ok" | "warn" | "err" } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Checked here purely to save a round trip — the server validates the rest.
    if (next !== confirm) {
      setNote({ text: "The two new passwords don't match.", kind: "err" });
      return;
    }
    setBusy(true);
    setNote(null);

    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const data = (await res.json()) as { ok: boolean; message?: string; weak?: boolean };

    if (data.ok) {
      setCurrent(""); setNext(""); setConfirm("");
      setNote(
        data.weak
          ? {
              text:
                "Changed. That password is short — the login throttle is what keeps it safe, so don't remove it.",
              kind: "warn",
            }
          : { text: "Password changed.", kind: "ok" }
      );
    } else {
      setNote({ text: data.message || "Could not change it.", kind: "err" });
    }
    setBusy(false);
  };

  const colour =
    note?.kind === "err" ? "#ffd7d4" : note?.kind === "warn" ? "var(--accent-hot)" : "var(--text-1)";

  return (
    <form onSubmit={submit} className="card p-5">
      <h2 className="font-display font-bold text-lg">Password</h2>
      <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-2)" }}>
        This is the only credential on the site. Changing it signs nobody out —
        your current session keeps working.
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="pw-current">Current</label>
          <input
            id="pw-current" type="password" autoComplete="current-password" required
            value={current} onChange={(e) => setCurrent(e.target.value)} className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="pw-next">New</label>
          <input
            id="pw-next" type="password" autoComplete="new-password" required
            value={next} onChange={(e) => setNext(e.target.value)} className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="pw-confirm">Repeat new</label>
          <input
            id="pw-confirm" type="password" autoComplete="new-password" required
            value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field"
          />
        </div>
      </div>

      {note && <p className="text-sm mt-3" style={{ color: colour }}>{note.text}</p>}

      <button type="submit" disabled={busy || !current || !next} className="btn mt-4">
        {busy ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
