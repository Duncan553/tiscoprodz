import { eq } from "drizzle-orm";
import { db } from "@/lib/cf";
import { orders } from "@/db/schema";
import { verifyWebhookHash, verifyPayment } from "@/lib/flutterwave";

/**
 * THE SAFETY NET.
 *
 * /api/checkout/verify only runs while the buyer's tab is open. People close
 * tabs, lose signal, and pay on a matatu. Flutterwave calls this regardless, so
 * the order still becomes `paid` and the files are waiting when they come back.
 *
 * THREE NON-NEGOTIABLES:
 *
 * 1. THE HASH IS CHECKED FIRST. This endpoint is public and anyone can POST to
 *    it — without the check, "your order is paid" is something a stranger can
 *    assert. Flutterwave does not sign the body; it sends a fixed shared secret
 *    in `verif-hash`, so this is a secret comparison, not an HMAC.
 *
 * 2. THE AMOUNT IS RE-VERIFIED AGAINST FLUTTERWAVE, not taken from the payload.
 *    The webhook body tells us WHICH transaction to look at; the authority on
 *    what it was worth is Flutterwave's own verify endpoint.
 *
 * 3. IT IS IDEMPOTENT. Flutterwave retries any non-2xx, and can deliver the
 *    same event twice. Anything already settled returns 200 and changes nothing.
 */
export async function POST(req: Request) {
  if (!verifyWebhookHash(req.headers.get("verif-hash"))) {
    console.error("[webhook] bad verif-hash — ignoring");
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event?: string; data?: { tx_ref?: string; status?: string } };
  try {
    event = (await req.json()) as typeof event;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const reference = event.data?.tx_ref;
  // An event we don't handle is not a failure, so it gets a 200 — otherwise
  // Flutterwave retries it forever.
  if (!reference || String(event.data?.status || "").toLowerCase() !== "successful") {
    return new Response("ok", { status: 200 });
  }

  const d = db();
  const order = await d.select().from(orders).where(eq(orders.reference, reference)).get();

  // Unknown reference: not ours, or a test event. Acknowledge and move on.
  if (!order) return new Response("ok", { status: 200 });
  if (order.status === "paid" || order.status === "flagged") {
    return new Response("ok", { status: 200 });
  }

  // Ask Flutterwave what it was really worth rather than trusting the payload.
  const tx = await verifyPayment(reference);
  const settled =
    tx.status === "success" &&
    tx.amountUsdCents === order.amountUsdCents &&
    (tx.currency || "").toUpperCase() === "USD";

  if (!settled) {
    console.error(
      `[webhook] mismatch ${reference}: flw=${tx.amountUsdCents} ${tx.currency} order=${order.amountUsdCents} USD`
    );
    await d
      .update(orders)
      .set({ status: "flagged", processorData: JSON.stringify(tx.raw) })
      .where(eq(orders.reference, reference));
    return new Response("ok", { status: 200 });
  }

  await d
    .update(orders)
    .set({
      status: "paid",
      paidAt: Math.floor(Date.now() / 1000),
      processorData: JSON.stringify(tx.raw),
    })
    .where(eq(orders.reference, reference));

  return new Response("ok", { status: 200 });
}
