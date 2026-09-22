import { getPromo } from "@/lib/promo-server";

/**
 * Is a promotion running? Public, because the cart has to show the same total
 * checkout will charge.
 *
 * This route has NO authority. /api/checkout reads the promotion itself and
 * recomputes the discount server-side, so a browser that lies about it changes
 * nothing about what it pays.
 */
export async function GET() {
  const promo = await getPromo();
  // Short cache only: switching a promotion off should take effect in seconds,
  // not after an hour of edge caching.
  return Response.json(promo, { headers: { "cache-control": "public, max-age=30" } });
}
