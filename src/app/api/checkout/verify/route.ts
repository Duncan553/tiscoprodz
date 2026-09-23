import { eq } from "drizzle-orm";
import { db } from "@/lib/cf";
import { orders } from "@/db/schema";
import { verifyPayment, chargeCurrency } from "@/lib/paystack";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * "Did the money land?" — polled by the cart while the buyer is on Paystack's
 * page, and once when they come back.
 *
 * Paystack is asked directly. The browser coming back to /cart is never
 * believed — anyone can type that URL.
 *
 * Two checks before anything is released:
 *   AMOUNT   — a different figure than the USD we recorded means `flagged`
 *   CURRENCY — anything but USD is also `flagged`, because a "successful"
 *              charge in another currency is not the charge we asked for
 * Flagged is paid-but-frozen: a human looks before files move.
 *
 * The download token is released here and nowhere else. That is what makes
 * "paid" and "can download" the same moment.
 */
export async function GET(req: Request) {
  try {
    const ip = clientIp(req);
    // A real checkout polls ~24 times over two minutes, plus manual retries.
    // 60 per 5 minutes sits above that and still blunts reference guessing.
    const limit = await rateLimit(`verify:ip:${ip}`, 60, 5 * 60);
    if (!limit.ok) {
      return Response.json({ ok: false, message: "Too many requests" }, { status: 429 });
    }

    const reference = new URL(req.url).searchParams.get("reference");
    if (!reference) {
      return Response.json({ ok: false, message: "Reference is required" }, { status: 400 });
    }

    const d = db();
    const order = await d.select().from(orders).where(eq(orders.reference, reference)).get();
    if (!order) {
      return Response.json({ ok: false, message: "Order not found" }, { status: 404 });
    }

    // Already settled — could be this route or the webhook that did it. Answer
    // from our own row instead of asking Paystack again.
    if (order.status === "paid") {
      return Response.json({
        ok: true,
        status: "paid",
        amountUsdCents: order.amountUsdCents,
        downloadToken: order.downloadToken,
      });
    }
    if (order.status === "flagged") {
      return Response.json({
        ok: true,
        status: "flagged",
        message: "We couldn't match the amount paid. Send us your reference and we'll sort it out.",
      });
    }

    const tx = await verifyPayment(reference);

    if (tx.status === "success") {
      const amountOk = tx.amountUsdCents === order.amountUsdCents;
      const currencyOk = (tx.currency || "").toUpperCase() === chargeCurrency();

      if (!amountOk || !currencyOk) {
        console.error(
          `[verify] mismatch ${reference}: paystack=${tx.amountUsdCents} ${tx.currency} order=${order.amountUsdCents} USD`
        );
        await d
          .update(orders)
          .set({ status: "flagged", processorData: JSON.stringify(tx.raw) })
          .where(eq(orders.reference, reference));
        return Response.json({ ok: true, status: "flagged", message: "Payment needs manual review." });
      }

      await d
        .update(orders)
        .set({
          status: "paid",
          paidAt: Math.floor(Date.now() / 1000),
          processorData: JSON.stringify(tx.raw),
        })
        .where(eq(orders.reference, reference));

      return Response.json({
        ok: true,
        status: "paid",
        amountUsdCents: order.amountUsdCents,
        downloadToken: order.downloadToken,
      });
    }

    if (tx.status === "failed") {
      await d
        .update(orders)
        .set({ status: "failed", processorData: JSON.stringify(tx.raw) })
        .where(eq(orders.reference, reference));
      return Response.json({ ok: true, status: "failed" });
    }

    // Still on the hosted page. Keep polling.
    return Response.json({ ok: true, status: "pending" });
  } catch (err) {
    console.error("[verify]", (err as Error).message);
    return Response.json({ ok: false, message: "Could not check the payment." }, { status: 500 });
  }
}
