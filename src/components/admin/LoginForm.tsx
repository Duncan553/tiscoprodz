"use client";

import { useState } from "react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await res.json()) as { ok: boolean; message?: string };
    if (data.ok) {
      // A full reload, not router.refresh(): the session is an HttpOnly cookie
      // the server reads, so the page has to be re-rendered by the server to see
      // it. A client-side refresh would re-run the old server render.
      window.location.reload();
    } else {
      setError(data.message || "Login failed.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto px-4 py-24">
      <h1 style={{ fontSize: "var(--text-h2)" }} className="font-display font-extrabold mb-6">Admin</h1>
      <label className="label" htmlFor="pw">Password</label>
      <input
        id="pw" type="password" autoComplete="current-password"
        value={password} onChange={(e) => setPassword(e.target.value)}
        className="field mb-4" autoFocus
      />
      {error && <p className="text-sm mb-4" style={{ color: "#f87171" }}>{error}</p>}
      <button type="submit" disabled={busy || !password} className="btn w-full">
        {busy ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
