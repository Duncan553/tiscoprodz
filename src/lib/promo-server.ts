/**
 * Reading and writing the promotion state. Server only — src/lib/promo.ts holds
 * the RULE and is shared with the browser; this holds the STORAGE.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/cf";
import { settings } from "@/db/schema";
import { PROMO_KEY, PROMO_OFF, type PromoState } from "@/lib/promo";

export async function getPromo(): Promise<PromoState> {
  const row = await db().select().from(settings).where(eq(settings.key, PROMO_KEY)).get();
  if (!row) return PROMO_OFF;
  try {
    const parsed = JSON.parse(row.value) as Partial<PromoState>;
    // Coerced, not trusted: a hand-edited settings row must not be able to put
    // a non-boolean into the discount maths.
    return { bogo: Boolean(parsed.bogo) };
  } catch {
    return PROMO_OFF;
  }
}

export async function setPromo(next: PromoState): Promise<void> {
  const value = JSON.stringify({ bogo: Boolean(next.bogo) });
  const nowSec = Math.floor(Date.now() / 1000);
  await db()
    .insert(settings)
    .values({ key: PROMO_KEY, value, updatedAt: nowSec })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: nowSec } });
}
