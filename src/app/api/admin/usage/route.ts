import { desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/cf";
import { uploads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { currentMonth, estimateMonthlyCostCents } from "@/lib/usage";

/**
 * How much has been uploaded, by month, and what is stored right now.
 *
 * Two different questions, and they need two different queries:
 *   - "how much did I upload in September" counts every upload that month,
 *     including files later deleted — the write happened and was billed.
 *   - "what am I storing" counts only objects still in the bucket, because
 *     storage is billed on what is there now.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const d = db();

  // Per-month upload totals, newest first. SUM in SQL rather than summing rows
  // in JS — the whole point is not to pull every upload row to add it up.
  const byMonth = await d
    .select({
      month: uploads.month,
      bytes: sql<number>`sum(${uploads.bytes})`,
      files: sql<number>`count(*)`,
    })
    .from(uploads)
    .groupBy(uploads.month)
    .orderBy(desc(uploads.month))
    .all();

  // Currently stored: everything not marked deleted.
  const storedRow = await d
    .select({
      bytes: sql<number>`coalesce(sum(${uploads.bytes}), 0)`,
      files: sql<number>`count(*)`,
    })
    .from(uploads)
    .where(isNull(uploads.deletedAt))
    .get();

  const byKind = await d
    .select({
      kind: uploads.kind,
      bytes: sql<number>`sum(${uploads.bytes})`,
    })
    .from(uploads)
    .where(isNull(uploads.deletedAt))
    .groupBy(uploads.kind)
    .all();

  const storedBytes = Number(storedRow?.bytes ?? 0);

  return Response.json({
    ok: true,
    currentMonth: currentMonth(),
    byMonth: byMonth.map((m) => ({
      month: m.month,
      bytes: Number(m.bytes),
      files: Number(m.files),
    })),
    stored: { bytes: storedBytes, files: Number(storedRow?.files ?? 0) },
    byKind: byKind.map((k) => ({ kind: k.kind, bytes: Number(k.bytes) })),
    estimatedMonthlyCostCents: estimateMonthlyCostCents(storedBytes),
  });
}
