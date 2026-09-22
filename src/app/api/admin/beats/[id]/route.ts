import { eq, inArray } from "drizzle-orm";
import { db, bucket, hasStorage } from "@/lib/cf";
import { beats, uploads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { UPLOAD_RULES, type UploadKind } from "@/lib/storage";

/**
 * PATCH — edit metadata, swap a file, or flip the published flag.
 *
 * Only the fields present in the body are touched. Building the update object
 * conditionally (rather than spreading the whole body) is what stops a request
 * from overwriting `mp3Key` with undefined and orphaning a paid beat's file.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const b = (await req.json()) as Record<string, unknown>;
  const set: Record<string, unknown> = {};

  if (b.title !== undefined) set.title = String(b.title).trim().slice(0, 120);
  if (b.bpm !== undefined) set.bpm = parseInt(String(b.bpm), 10) || 0;
  if (b.musicalKey !== undefined) set.musicalKey = String(b.musicalKey).trim().slice(0, 12);
  if (b.genre !== undefined) set.genre = String(b.genre).trim().slice(0, 40);
  if (b.tags !== undefined) {
    set.tags = String(b.tags)
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && t.length <= 30)
      .slice(0, 10)
      .join(",");
  }
  // No price fields: prices belong to the licence TIER, not the beat. See
  // src/lib/licenses.ts.

  // ---- swapping a file on an existing beat ------------------------------
  //
  // Previously the only way to replace a preview, a cover, or to add the real
  // MP3 once it was exported, was to DELETE the beat and re-upload everything.
  // That loses the beat's id — which is the URL people have, and the id written
  // into every past order's `items`. Replacing one key in place keeps both.
  //
  // The old object is deliberately NOT deleted here: a paid order may still be
  // entitled to the file that was sold. Orphaned objects cost storage; breaking
  // a delivered download costs a customer.
  const FILE_FIELDS: Array<[string, UploadKind, "coverKey" | "previewKey" | "mp3Key" | "wavKey" | "stemsKey"]> = [
    ["coverKey", "cover", "coverKey"],
    ["previewKey", "preview", "previewKey"],
    ["mp3Key", "mp3", "mp3Key"],
    ["wavKey", "wav", "wavKey"],
    ["stemsKey", "stems", "stemsKey"],
  ];
  for (const [field, kind, column] of FILE_FIELDS) {
    if (b[field] === undefined) continue;
    const key = b[field] === null ? null : String(b[field]);
    // Clearing is only allowed for the optional slots. An empty mp3Key would
    // leave a published beat with no deliverable at any tier.
    if (key === null) {
      if (column === "coverKey" || column === "previewKey" || column === "mp3Key") {
        return Response.json(
          { ok: false, message: `${column} is required and cannot be cleared.` },
          { status: 400 }
        );
      }
      set[column] = null;
      continue;
    }
    // Same prefix check as creation: a key from the browser must sit in the
    // prefix its slot owns, or a private object could be published as a preview.
    if (!key.startsWith(`${UPLOAD_RULES[kind].prefix}/`)) {
      return Response.json(
        { ok: false, message: `${column} must be an uploaded ${kind} file.` },
        { status: 400 }
      );
    }
    set[column] = key;
  }
  // 0/1, not a boolean — SQLite has no boolean type (see the schema).
  if (b.published !== undefined) set.published = b.published ? 1 : 0;

  if (Object.keys(set).length === 0) {
    return Response.json({ ok: false, message: "Nothing to update." }, { status: 400 });
  }

  const updated = await db().update(beats).set(set).where(eq(beats.id, id)).returning().get();
  // RETURNING is the point of this shape. An UPDATE that matched no rows is not
  // an error in SQL — it just changes nothing. jst-beat's dashboard showed
  // "Updated successfully" over exactly that silence for weeks.
  if (!updated) {
    return Response.json({ ok: false, message: "No beat with that id." }, { status: 404 });
  }

  return Response.json({ ok: true, beat: updated });
}

/**
 * DELETE — the row, then the files.
 *
 * Row first on purpose. If the R2 deletes fail halfway you are left with
 * unreferenced objects costing storage, which is annoying. Files first and a
 * failed row delete leaves a LIVE beat in the catalogue whose master is gone —
 * buyable, unpayable-for, broken. Cheap mess beats broken.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const d = db();

  const row = await d.select().from(beats).where(eq(beats.id, id)).get();
  if (!row) return Response.json({ ok: false, message: "No beat with that id." }, { status: 404 });

  await d.delete(beats).where(eq(beats.id, id));

  const keys = [row.coverKey, row.previewKey, row.mp3Key, row.wavKey, row.stemsKey].filter(
    (k): k is string => Boolean(k)
  );
  // R2's delete takes an array, so this is one call, not five. Skipped when
  // storage is absent — the row still goes, which is what the producer asked
  // for; there are simply no objects to clean up.
  if (hasStorage()) await bucket().delete(keys);

  // Mark the upload rows deleted rather than removing them: the bytes still
  // count toward the month they were uploaded in (that write was billed), but
  // they stop counting toward what is stored now.
  await db()
    .update(uploads)
    .set({ deletedAt: Math.floor(Date.now() / 1000) })
    .where(inArray(uploads.objectKey, keys));

  return Response.json({ ok: true });
}
