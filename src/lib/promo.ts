/**
 * THE DISCOUNT RULE. One function, used by the cart to DISPLAY and by checkout
 * to CHARGE — because a promotion that shows one total and bills another is the
 * fastest way to lose a customer's trust.
 *
 * Currently one promotion: BUY ONE, GET ONE FREE, switched on and off by the
 * producer at /admin. It is stored in the `settings` table rather than an env
 * var so flipping it is a click, not a redeploy.
 *
 * THE RULE, stated exactly:
 *   Pairing happens WITHIN A LICENCE TIER, never across tiers. Two MP3 licences
 *   make a pair and one is free. An MP3 and a WAV do not pair at all.
 *   Within a tier, every second licence is free.
 *
 * WHY IT IS PER-TIER, because the first version was not and it was wrong:
 * a flat "cheapest of each pair is free" meant someone could put a $120
 * Trackout and a $19.99 MP3 in the basket and have the MP3 thrown in — buying
 * one product and being given a different, cheaper one. "Buy one, get one free"
 * has always meant one of the SAME thing. It also protects the price ladder:
 * under the old rule the cheap tiers became a freebie attached to the expensive
 * ones, and nobody would ever buy an MP3 licence on its own again.
 *
 * Within a tier every licence costs the same, so which one is "free" is
 * arithmetic rather than a choice: n licences of a tier priced p give
 * floor(n / 2) free.
 */

import { LICENSES, type LicenseId } from "@/lib/licenses";

export const PROMO_KEY = "promo_bogo";

export interface PromoState {
  /** Buy one, get one free — within the same licence tier. */
  bogo: boolean;
}

export const PROMO_OFF: PromoState = { bogo: false };

/** One cart line, as far as the discount is concerned. */
export interface PromoLine {
  license: LicenseId;
  usdCents: number;
}

export interface PromoResult {
  /** USD cents before any discount. */
  subtotalCents: number;
  /** USD cents taken off. 0 when no promotion applies. */
  discountCents: number;
  /** What is actually charged. */
  totalCents: number;
  /** How many licences came out free — for the "1 free" badge in the cart. */
  freeCount: number;
  /**
   * Tiers holding an odd number of licences, so one more of THAT tier would be
   * free. The cart uses this to say something useful instead of a vague nudge.
   */
  oneAwayFrom: LicenseId[];
}

/**
 * Applies the active promotion to the cart.
 *
 * Pure and free of server imports on purpose: the browser calls it for the cart
 * total and the Worker calls it for the charge, so there is exactly one
 * implementation and no way for the two to drift.
 */
export function applyPromo(lines: PromoLine[], promo: PromoState): PromoResult {
  const subtotalCents = lines.reduce((sum, l) => sum + l.usdCents, 0);

  if (!promo.bogo || lines.length < 2) {
    return {
      subtotalCents,
      discountCents: 0,
      totalCents: subtotalCents,
      freeCount: 0,
      oneAwayFrom: [],
    };
  }

  // Group by tier. Pairing never crosses a group — that IS the rule.
  const byTier = new Map<LicenseId, number[]>();
  for (const l of lines) {
    const arr = byTier.get(l.license) ?? [];
    arr.push(l.usdCents);
    byTier.set(l.license, arr);
  }

  let discountCents = 0;
  let freeCount = 0;
  const oneAwayFrom: LicenseId[] = [];

  for (const [license, prices] of byTier) {
    const free = Math.floor(prices.length / 2);
    if (free > 0) {
      // Sorted ascending and the CHEAPEST taken first. Within a tier every
      // price is identical, so this only matters if a tier's price ever varies
      // per beat — and if it does, the customer keeps the dearer one.
      const sorted = [...prices].sort((a, b) => a - b);
      for (let i = 0; i < free; i++) discountCents += sorted[i];
      freeCount += free;
    }
    // An odd count means one more of this same tier comes free.
    if (prices.length % 2 === 1) oneAwayFrom.push(license);
  }

  return {
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    freeCount,
    oneAwayFrom,
  };
}

/** Short line for the banner and the cart. Null when nothing is running. */
export function promoLabel(promo: PromoState): string | null {
  return promo.bogo ? "Buy one licence, get the same licence free" : null;
}

/** "another MP3 License" / "another WAV + MP3 License or Trackout License" */
export function oneAwayLabel(ids: LicenseId[]): string | null {
  if (ids.length === 0) return null;
  const names = ids.map((id) => LICENSES[id].name);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  return `Add another ${list} and it's free.`;
}
