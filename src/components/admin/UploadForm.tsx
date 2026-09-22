"use client";

import { useState } from "react";
import { UPLOAD_RULES, PREVIEW_ADVISORY_BYTES, type UploadKind } from "@/lib/storage";

/**
 * NEW BEAT — the files, and nothing about price.
 *
 * Two steps, and the order matters:
 *   1. each file is POSTed to /api/admin/upload, which streams it into R2 and
 *      returns the KEY it chose
 *   2. those keys plus the metadata go to /api/admin/beats, which writes the row
 *
 * THERE ARE NO PRICE FIELDS. The licensing spec sets one price per TIER for the
 * whole catalogue (src/lib/licenses.ts). What this form decides is which tiers a
 * beat can serve, and it decides that by WHICH FILES YOU UPLOAD: no WAV means
 * only the MP3 licence, no stems means no Trackout.
 *
 * Files first because a row pointing at a file that failed to upload is a broken
 * beat in the catalogue. The other way round leaves orphaned objects in R2 —
 * wasted pennies, not a broken store.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: generate the preview clip. jst-beat ran
 * ffmpeg on the server to trim the master and mix in a voice tag. That cannot
 * happen in a Worker — there is no filesystem and no way to run a binary. So the
 * PREVIEW IS UPLOADED, already tagged, from the DAW. It is one extra bounce in
 * the export and it removes an entire class of server-side failure.
 */
export function UploadForm({ onCreated }: { onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  /** Non-blocking note kept separate from `error` — advice is not a failure. */
  const [advice, setAdvice] = useState("");

  /**
   * Uploads one file and returns the R2 key.
   *
   * XMLHttpRequest rather than fetch, for one reason: PROGRESS. A 60MB WAV over
   * Kenyan mobile data takes minutes, and a form with no progress bar is
   * indistinguishable from a form that has hung — which is when people reload
   * the page and lose the upload.
   *
   * It also turns the two useless failures into real messages:
   *   "Failed to fetch"  — what fetch() throws when the connection drops. It
   *                        says nothing about why. Most often the dev server
   *                        restarted mid-upload, or the network moved.
   *   "Unexpected token" — what res.json() throws when a proxy answers with
   *                        plain text or an HTML error page instead of JSON.
   */
  const uploadOne = (kind: UploadKind, file: File): Promise<string> => {
    // Check the size BEFORE sending. Discovering a file is too big after three
    // minutes of uploading is the worst possible time to find out, and the
    // server's 413 may never arrive as a readable response anyway.
    const rule = UPLOAD_RULES[kind];
    if (file.size > rule.maxBytes) {
      return Promise.reject(
        new Error(
          `${file.name} is ${(file.size / 1048576).toFixed(1)}MB. The limit for the ${kind} is ${Math.round(rule.maxBytes / 1048576)}MB.`
        )
      );
    }
    if (file.size === 0) {
      return Promise.reject(new Error(`${file.name} is empty.`));
    }

    return new Promise<string>((resolve, reject) => {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/upload");
      // The session is an HttpOnly cookie, so nothing has to be attached here —
      // the browser sends it automatically. That is the whole reason this app
      // has no Authorization header anywhere.
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        setStatus(`Uploading ${kind} — ${pct}% of ${(file.size / 1048576).toFixed(1)}MB`);
      };

      xhr.onload = () => {
        let data: { ok?: boolean; key?: string; message?: string };
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          reject(
            new Error(
              xhr.status === 413
                ? `${file.name} was rejected as too large by the server.`
                : `Server error ${xhr.status}: ${xhr.responseText.slice(0, 120) || "empty response"}`
            )
          );
          return;
        }
        if (!data.ok || !data.key) {
          reject(new Error(data.message || `Upload of ${kind} failed.`));
          return;
        }
        resolve(data.key);
      };

      // This is the "Failed to fetch" case, finally with something useful in it.
      xhr.onerror = () =>
        reject(
          new Error(
            `The connection dropped while uploading ${file.name}. Check you're still online and that the server is running, then try again — nothing was saved.`
          )
        );
      xhr.ontimeout = () => reject(new Error(`${file.name} timed out. Try again on a better connection.`));
      xhr.onabort = () => reject(new Error(`Upload of ${file.name} was cancelled.`));

      xhr.send(form);
    });
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const el = e.currentTarget;

    const pick = (name: string): File | null => {
      const f = form.get(name);
      return f instanceof File && f.size > 0 ? f : null;
    };

    const cover = pick("cover");
    const preview = pick("preview");
    const mp3 = pick("mp3");
    const wav = pick("wav");
    const stems = pick("stems");

    if (!cover || !preview || !mp3) {
      setError("Cover, tagged preview and the untagged MP3 are all required.");
      return;
    }
    // Every tier above MP3 delivers the WAV, and Trackout delivers stems on top
    // of it — so stems without a WAV would make the $120 tier sellable while the
    // $35.99 one isn't. The server refuses this too; catching it here saves the
    // producer a long upload first.
    if (stems && !wav) {
      setError("Upload the WAV as well — Trackout can't be sold without it.");
      return;
    }

    setBusy(true);
    setError("");
    setAdvice("");
    try {
      // Advisory, not a gate. A heavy preview is the producer's decision — but
      // it is a decision with a cost that lands on every visitor, so say so
      // once rather than silently accepting it.
      if (preview.size > PREVIEW_ADVISORY_BYTES) {
        setAdvice(
          `Heads up: that preview is ${(preview.size / 1048576).toFixed(1)}MB. Every visitor downloads it in full before they hear anything. Exporting the same clip as a 192kbps MP3 would be around ${(preview.size / 1048576 / 8).toFixed(1)}MB and sound the same on a phone.`
        );
      }

      const coverKey = await uploadOne("cover", cover);
      const previewKey = await uploadOne("preview", preview);
      const mp3Key = await uploadOne("mp3", mp3);
      const wavKey = wav ? await uploadOne("wav", wav) : null;
      const stemsKey = stems ? await uploadOne("stems", stems) : null;

      setStatus("Saving the beat…");
      const res = await fetch("/api/admin/beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          bpm: form.get("bpm"),
          musicalKey: form.get("musicalKey"),
          genre: form.get("genre"),
          tags: form.get("tags"),
          coverKey, previewKey, mp3Key, wavKey, stemsKey,
        }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) throw new Error(data.message || "Could not save the beat.");

      setStatus("Saved as a DRAFT. Check it, then publish it below.");
      el.reset();
      onCreated();
    } catch (err) {
      setError((err as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <h2 className="font-display font-bold text-lg">New beat</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" required maxLength={120} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="genre">Genre</label>
          <input id="genre" name="genre" required maxLength={40} className="field" placeholder="Drill" />
        </div>
        <div>
          <label className="label" htmlFor="bpm">BPM</label>
          <input id="bpm" name="bpm" type="number" min={40} max={300} required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="musicalKey">Key</label>
          <input id="musicalKey" name="musicalKey" required maxLength={12} className="field" placeholder="F# minor" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="tags">Tags (comma separated)</label>
        <input id="tags" name="tags" className="field" placeholder="dark, 808, trap" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="cover">Cover art — public</label>
          <input id="cover" name="cover" type="file" accept="image/*" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="preview">Tagged preview — public</label>
          <input id="preview" name="preview" type="file" accept="audio/*" required className="field" />
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
            Export from the DAW with your voice tag already on it — this is the
            clip the whole internet streams. MP3 is the right format here: a WAV
            preview is the same few seconds at roughly eight times the download.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="mp3">Untagged MP3 — required</label>
          <input id="mp3" name="mp3" type="file" accept="audio/*" required className="field" />
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
            Every licence tier delivers this. Max 50MB.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="wav">Untagged WAV — optional</label>
          <input id="wav" name="wav" type="file" accept="audio/*" className="field" />
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
            Without it, only the MP3 licence can be sold. Max 100MB.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="stems">Stems ZIP — optional</label>
          <input id="stems" name="stems" type="file" accept=".zip,application/zip" className="field" />
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
            Needed for Trackout. Max 100MB.
          </p>
        </div>
      </div>

      {status && <p className="text-sm" style={{ color: "var(--accent-hot)" }}>{status}</p>}
      {advice && <p className="text-sm" style={{ color: "var(--text-2)" }}>{advice}</p>}
      {error && <p className="text-sm" style={{ color: "#ffd7d4" }}>{error}</p>}

      <button type="submit" disabled={busy} className="btn w-full">
        {busy ? "Working…" : "Upload beat"}
      </button>
    </form>
  );
}
