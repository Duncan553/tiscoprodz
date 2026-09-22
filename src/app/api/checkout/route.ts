import { inArray, eq } from "drizzle-orm";
import { db, env } from "@/lib/cf";
import { beats, orders } from "@/db/schema";
import { startPayment, producerShareCents, hasSplit } from "@/lib/flutterwave";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { LICENSES, isLicenseId, isAvailableFor, type LicenseId } from "@/lib/licenses";
import { applyPromo } from "@/lib/promo";
import { getPromo } from "@/lib/promo-server";

/**
 * CHECKOUT. The one route where money starts moving.
 *
 * The rule that shapes everything below: THE BROWSER NEVER NAMES A PRICE.
 * It sends beat ids and licence tiers; every figure is read from the licence
 * table on the server. Trusting a posted amount is how a store sells a $120
 * Trackout for one cent.
 *
 * Charged in US DOLLARS, the same dollars the catalogue displays. There is no
 * conversion anywhere in this file, because there is no second currency.
 *
 * Order of operations, and why it cannot be rearranged:
 *   1. rate limit             before any work
 *   2. price from the tiers   the authority
 *   3. apply the promotion    read from the DB, never from the request
 *   4. INSERT the order       before charging, so a payer always has a row
 *   5. call Flutterwave       last, because it is the irreversible step
 *
 * Step 3 before step 4 is the important one. If the insert fails after the
 * charge, someone has paid for files the download route can never find.
 */

interface IncomingLine {
  beat_id?: unknown;
  license?: unknown;
}

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);

    const ipLimit = await rateLimit(`checkout:ip:${ip}`, 10, 10 * 60);
    if (!ipLimit.ok) {
      return Response.json(
        { ok: false, message: "Too many attempts, try again shortly." },
        { status: 429, headers: { "retry-after": String(ipLimit.retryAfter ?? 60) } }
      );
    }

    const body = (await req.json()) as { email?: string; items?: IncomingLine[] };
    const email = String(body.email || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ ok: false, message: "A valid email is required for the receipt." }, { status: 400 });
    }
    if (items.length === 0) {
      return Response.json({ ok: false, message: "Your cart is empty." }, { status: 400 });
    }

    const beatIds = [...new Set(items.map((i) => String(i.beat_id || "")).filter(Boolean))];
    if (beatIds.length === 0) {
      return Response.json({ ok: false, message: "Invalid cart." }, { status: 400 });
    }

    const d = db();
    const rows = await d.select().from(beats).where(inArray(beats.id, beatIds)).all();
    const byId = new Map(rows.map((b) => [b.id, b]));

    const verified: Array<{
      beat_id: string;
      title: string;
      license: string;
      usd_cents: number;
    }> = [];

    for (const line of items) {
      const beat = byId.get(String(line.beat_id));
      const licenseId = line.license;

      if (!isLicenseId(licenseId)) {
        return Response.json({ ok: false, message: "Unknown licence." }, { status: 400 });
      }

      // A draft is not purchasable even if someone kept the id from before it
      // was unpublished.
      if (!beat || beat.published !== 1) {
        return Response.json(
          { ok: false, message: "One of the beats in your cart is no longer on sale." },
          { status: 400 }
        );
      }

      // One check covers three failures: a tier that isn't sold online
      // (Exclusive is negotiation only), and a tier whose files this beat does
      // not have. Selling a Trackout with no stems uploaded would take the
      // money and deliver nothing.
      const files = {
        hasMp3: Boolean(beat.mp3Key),
        hasWav: Boolean(beat.wavKey),
        hasStems: Boolean(beat.stemsKey),
      };
      if (!isAvailableFor(licenseId, files)) {
        return Response.json(
          { ok: false, message: `${LICENSES[licenseId].name} isn't available for ${beat.title}.` },
          { status: 400 }
        );
      }

      // The price comes from the licence table, never from the request.
      const usdCents = LICENSES[licenseId].priceCents!;
      verified.push({
        beat_id: beat.id,
        title: beat.title,
        license: licenseId,
        usd_cents: usdCents,
      });
    }

    // THE DISCOUNT IS APPLIED HERE, on the server, from the promotion state the
    // server reads for itself. The cart runs the identical function for display
    // (src/lib/promo.ts), so the two cannot disagree — but this is the one that
    // decides what gets charged.
    const promo = await getPromo();
    const { subtotalCents, discountCents, totalCents } = applyPromo(
      // The licence goes with the price: pairing happens WITHIN a tier, so the
      // discount cannot be computed from prices alone.
      verified.map((v) => ({ license: v.license as LicenseId, usdCents: v.usd_cents })),
      promo
    );

    // Flutterwave's floor for a USD charge — checked on the DISCOUNTED total,
    // because that is the figure being sent.
    if (totalCents < 100) {
      return Response.json({ ok: false, message: "Minimum order is $1." }, { status: 400 });
    }

    const reference = `TSC-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    // 32 random bytes. THIS, not the reference, is what unlocks the files —
    // the reference is a timestamp plus a small random and is guessable.
    const downloadToken = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // The split is computed on the DISCOUNTED total — the producer's 90% is of
    // what the customer actually paid, not of a list price nobody was charged.
    const producerCents = producerShareCents(totalCents);

    // WHETHER FLUTTERWAVE WILL SETTLE THE PRODUCER DIRECTLY, recorded on the
    // order. This was missing, and the column defaults to 0 — so every order,
    // including ones Flutterwave had already split at source, was stored as
    // "not split". The earnings page reads exactly that flag to decide what
    // still has to be paid by hand, so it was reporting the producer's full 90%
    // as owed on orders they had already been paid for. Paying that list out
    // would have paid them twice.
    //
    // Read from `hasSplit()` at INSERT time rather than from what startPayment
    // returns, so the flag is written atomically with the row it describes —
    // both read the same env var, and a later UPDATE could fail and leave the
    // row lying.
    const splitApplied = hasSplit();

    await d.insert(orders).values({
      reference,
      email,
      amountUsdCents: totalCents,
      subtotalUsdCents: subtotalCents,
      discountUsdCents: discountCents,
      producerUsdCents: producerCents,
      platformUsdCents: totalCents - producerCents,
      splitApplied: splitApplied ? 1 : 0,
      items: JSON.stringify(verified),
      status: "pending",
      downloadToken,
    });

    const origin = env().SITE_URL || new URL(req.url).origin;

    const { checkoutUrl } = await startPayment({
      email,
      amountUsdCents: totalCents,
      reference,
      // Flutterwave appends ?tx_ref=…&status=… to this. The cart reads tx_ref
      // and verifies server-side; the status in the URL is never believed.
      redirectUrl: `${origin}/cart`,
      metadata: { order_id: reference, item_count: verified.length },
    });

    // No download token in this reply: the order is still `pending`. The token
    // is released by /api/checkout/verify once Flutterwave confirms the amount.
    return Response.json({
      ok: true,
      reference,
      checkoutUrl,
      amountUsdCents: totalCents,
      subtotalUsdCents: subtotalCents,
      discountUsdCents: discountCents,
    });
  } catch (err) {
    console.error("[checkout]", (err as Error).message);
    return Response.json(
      { ok: false, message: (err as Error).message || "Could not start the payment." },
      { status: 500 }
    );
  }
}
