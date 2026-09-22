/**
 * The paid-order gate. Both download routes ask this the same question, so the
 * rule lives in one place: an order only unlocks files when it is `paid` AND the
 * caller presents the token stored on that row.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/cf";
import { orders } from "@/db/schema";

export interface OrderLine {
  beat_id: string;
  title: string;
  /** A LicenseId, frozen at purchase time — re-pricing a tier later must not
   *  rewrite what someone already bought. */
  license: string;
  usd_cents: number;
}

export async function authorizeOrder(reference: string | null, token: string | null) {
  if (!reference || !token) return null;

  const order = await db().select().from(orders).where(eq(orders.reference, reference)).get();
  if (!order || order.status !== "paid") return null;

  // Constant-time compare. `!==` returns on the first wrong byte, and that
  // timing difference is measurable across enough guesses.
  const a = order.downloadToken;
  if (a.length !== token.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ token.charCodeAt(i);
  if (diff !== 0) return null;

  return { order, lines: JSON.parse(order.items) as OrderLine[] };
}
