import { desc } from "drizzle-orm";
import { db } from "@/lib/cf";
import { beats } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { UPLOAD_RULES } from "@/lib/storage";

/** GET — the admin list. Drafts included; this is the only place they show. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const rows = await db().select().from(beats).orderBy(desc(beats.createdAt)).all();
  return Response.json({ ok: true, beats: rows });
}

/**
 * POST — create the beat row. The files are already in R2 (see
 * /api/admin/upload); this receives their keys.
 *
 * NO PRICES HERE. The licensing spec sets one price per TIER for the whole
 * catalogue, so prices live in src/lib/licenses.ts. What a beat decides is not
 * what it costs but WHICH TIERS IT CAN SERVE — a beat with no stems simply
 * cannot be sold as a Trackout, and that follows from the files, not a field.
 *
 * NEW BEATS ARE DRAFTS. `published` is 0 and only the toggle flips it, because
 * a beat with the master uploaded as the preview is a mistake that costs money.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = (await req.json()) as Record<string, unknown>;

  const title = String(b.title || "").trim();
  const bpm = parseInt(String(b.bpm), 10) || 0;
  const musicalKey = String(b.musicalKey || "").trim();
  const genre = String(b.genre || "").trim();

  const coverKey = String(b.coverKey || "");
  const previewKey = String(b.previewKey || "");
  const mp3Key = String(b.mp3Key || "");
  const wavKey = b.wavKey ? String(b.wavKey) : null;
  const stemsKey = b.stemsKey ? String(b.stemsKey) : null;

  if (!title || !musicalKey || !genre || !coverKey || !previewKey || !mp3Key) {
    return Response.json(
      { ok: false, message: "Title, key, genre, cover, preview and the untagged MP3 are all required." },
      { status: 400 }
    );
  }
  if (title.length > 120 || musicalKey.length > 12 || genre.length > 40) {
    return Response.json({ ok: false, message: "One of those fields is too long." }, { status: 400 });
  }
  if (bpm < 40 || bpm > 300) {
    return Response.json({ ok: false, message: "BPM should be between 40 and 300." }, { status: 400 });
  }
  // Stems without a WAV would leave Trackout sellable while WAV+MP3 is not,
  // which contradicts the tier ladder — a higher tier cannot be available when
  // a lower one is missing its files.
  if (stemsKey && !wavKey) {
    return Response.json(
      { ok: false, message: "Upload the WAV too — a beat can't sell Trackout without it." },
      { status: 400 }
    );
  }

  // The keys come from the browser, so confirm each sits in the prefix its slot
  // is allowed to use. Otherwise a crafted request could point `previewKey` at
  // a private object and publish the untagged master as the free preview.
  const prefixOk = (key: string, kind: keyof typeof UPLOAD_RULES) =>
    key.startsWith(`${UPLOAD_RULES[kind].prefix}/`);
  if (
    !prefixOk(coverKey, "cover") ||
    !prefixOk(previewKey, "preview") ||
    !prefixOk(mp3Key, "mp3") ||
    (wavKey && !prefixOk(wavKey, "wav")) ||
    (stemsKey && !prefixOk(stemsKey, "stems"))
  ) {
    return Response.json({ ok: false, message: "A file key is in the wrong place." }, { status: 400 });
  }

  const tags = String(b.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 30)
    .slice(0, 10)
    .join(",");

  const row = {
    id: crypto.randomUUID(),
    title,
    bpm,
    musicalKey,
    genre,
    tags,
    coverKey,
    previewKey,
    mp3Key,
    wavKey,
    stemsKey,
    published: 0,
  };

  await db().insert(beats).values(row);
  return Response.json({ ok: true, beat: row });
}
