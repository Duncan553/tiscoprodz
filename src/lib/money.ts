/**
 * MONEY. Integers only, and dollars only.
 *
 * Every amount in this app is an integer of USD cents. Nothing is ever a float,
 * because a float cannot hold 0.1 exactly and a catalogue that loses a cent per
 * sale is invisible until the settlement statement.
 *
 * THERE IS NO SECOND CURRENCY. An earlier version derived a KSh figure from a
 * cached FX rate and showed it beside every price. It is gone, along with the
 * rate cache, the /api/rate route and the two KES columns on `orders` — the
 * site prices in dollars, charges dollars, and lets the buyer's bank do
 * whatever it does. One currency means there is nothing to keep in sync and
 * nothing that can disagree.
 */

/** "$20" for whole dollars, "$19.99" when there are cents. */
export function formatUsd(usdCents: number): string {
  const n = usdCents / 100;
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

/** Parse a typed price like "24.99" into cents. Returns 0 for junk. */
export function parseToCents(input: string | number): number {
  const n = Number(String(input).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
