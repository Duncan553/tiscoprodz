/**
 * The row -> PublicBeat boundary. Everything the public sees passes through
 * here, which is the single place the private R2 keys get dropped.
 */
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/cf";
import { beats } from "@/db/schema";
import { mediaUrl } from "@/lib/storage";
import type { PublicBeat } from "@/types/beat";
import type { Beat } from "@/db/schema";

export function toPublicBeat(row: Beat): PublicBeat {
  return {
    id: row.id,
    title: row.title,
    bpm: row.bpm,
    musicalKey: row.musicalKey,
    genre: row.genre,
    // Stored as one comma-separated string; split here so no component has to.
    tags: row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    coverUrl: mediaUrl(row.coverKey),
    previewUrl: mediaUrl(row.previewKey),
    // Booleans, not keys. The browser needs to know which tiers it can offer;
    // it must never learn where the untagged files live. See types/beat.ts.
    hasMp3: Boolean(row.mp3Key),
    hasWav: Boolean(row.wavKey),
    hasStems: Boolean(row.stemsKey),
    createdAt: row.createdAt,
  };
}

/** The catalogue. Drafts never appear. */
export async function listPublicBeats(): Promise<PublicBeat[]> {
  const rows = await db()
    .select()
    .from(beats)
    .where(eq(beats.published, 1))
    .orderBy(desc(beats.createdAt))
    .all();
  return rows.map(toPublicBeat);
}

export async function getPublicBeat(id: string): Promise<PublicBeat | null> {
  const row = await db()
    .select()
    .from(beats)
    .where(and(eq(beats.id, id), eq(beats.published, 1)))
    .get();
  return row ? toPublicBeat(row) : null;
}
