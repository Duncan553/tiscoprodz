import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/cf";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { PRODUCER_SHARE, hasSplit } from "@/lib/flutterwave";

/**
 * EARNINGS — what was sold, and how it was split.
 *
 * Only PAID orders count. A `pending` order is someone who reached the payment
 * page and may never come back; counting those as revenue is how a dashboard
 * ends up lying.
 *
 * `needsManualPayout` is the number that matters operationally: orders that
 * completed before a producer subaccount existed, so the whole amount landed in
 * the main account and the producer's share still has to be sent by hand.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const d = db();

  const totals = await d
    .select({
      orders: sql<number>`count(*)`,
      gross: sql<number>`coalesce(sum(${orders.amountUsdCents}), 0)`,
      producer: sql<number>`coalesce(sum(${orders.producerUsdCents}), 0)`,
      platform: sql<number>`coalesce(sum(${orders.platformUsdCents}), 0)`,
      discounted: sql<number>`coalesce(sum(${orders.discountUsdCents}), 0)`,
    })
    .from(orders)
    .where(eq(orders.status, "paid"))
    .get();

  const unsplit = await d
    .select({
      n: sql<number>`count(*)`,
      owed: sql<number>`coalesce(sum(${orders.producerUsdCents}), 0)`,
    })
    .from(orders)
    .where(sql`${orders.status} = 'paid' and ${orders.splitApplied} = 0`)
    .get();

  // Flagged orders are paid but frozen pending a human check — surfaced here
  // because otherwise nobody would ever look for them.
  const flagged = await d
    .select({ n: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.status, "flagged"))
    .get();

  const recent = await d
    .select({
      reference: orders.reference,
      email: orders.email,
      amountUsdCents: orders.amountUsdCents,
      producerUsdCents: orders.producerUsdCents,
      platformUsdCents: orders.platformUsdCents,
      splitApplied: orders.splitApplied,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(12)
    .all();

  return Response.json({
    ok: true,
    producerSharePct: Math.round(PRODUCER_SHARE * 100),
    splitConfigured: hasSplit(),
    totals: {
      orders: Number(totals?.orders ?? 0),
      grossCents: Number(totals?.gross ?? 0),
      producerCents: Number(totals?.producer ?? 0),
      platformCents: Number(totals?.platform ?? 0),
      discountedCents: Number(totals?.discounted ?? 0),
    },
    needsManualPayout: {
      orders: Number(unsplit?.n ?? 0),
      owedCents: Number(unsplit?.owed ?? 0),
    },
    flagged: Number(flagged?.n ?? 0),
    recent,
  });
}
