/**
 * PAYSTACK — the only processor on this site.
 *
 * Hosted checkout: the buyer leaves for Paystack's page, pays by card there,
 * and comes back. We never see a card number, which keeps this site entirely out
 * of PCI scope. That is a legal reason not to build our own payment form, not a
 * technical one.
 *
 * Written with plain `fetch` and Web Crypto — no SDK, no node:crypto. Not a
 * style choice: `crypto.createHmac` does not exist in the Workers runtime.
 *
 * THE SITE CHARGES IN US DOLLARS, CARD ONLY. Beats are priced in USD in the
 * database, so the $19.99 on the beat row is the $19.99 Paystack asks for.
 * No M-Pesa: that is a shilling rail and cannot carry a dollar charge.
 * Paystack Kenya needs international payments + USD enabled on the account
 * (a Kenyan USD bank account to settle into) or every call here is refused.
 *
 * Amounts are CENTS end to end — Paystack takes the currency's subunit, which
 * is exactly how the rest of the app stores money. No conversion anywhere.
 */
import { env } from "@/lib/cf";

const BASE = "https://api.paystack.co";

function secret(): string {
  const key = env().PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Paystack is not configured");
  return key;
}

/**
 * THE REVENUE SPLIT.
 *
 * The producer keeps 90%, the platform keeps 10%. Paystack settles the
 * producer's share DIRECTLY to their subaccount (`ACCT_…`) — the money never
 * sits in the platform's balance waiting to be forwarded.
 *
 * HOW PAYSTACK MODELS THIS — the mirror image of Flutterwave, so read twice:
 * `transaction_charge` is what the MAIN account keeps, and the subaccount gets
 * the rest. So we send the PLATFORM's 10% as a flat cent amount, and the
 * producer receives the 90% remainder. A flat amount, not the subaccount's
 * stored percentage, so a discounted cart splits exactly.
 *
 * WHO BEARS PAYSTACK'S FEE: `bearer` is left at its default, "account", so the
 * fee comes out of the platform's 10% and the producer's 90% is 90% of the
 * sticker price — the number they were promised.
 */
export const PRODUCER_SHARE = 0.9;

/** Cents -> the producer's cut, in cents. Rounded DOWN, never up. */
export function producerShareCents(totalCents: number): number {
  // floor, so rounding can never hand out more than was collected. The odd
  // cent stays with the platform rather than creating a shortfall.
  return Math.floor(totalCents * PRODUCER_SHARE);
}

/** True once a producer subaccount code has been configured. */
export function hasSplit(): boolean {
  return Boolean(env().PAYSTACK_PRODUCER_SUBACCOUNT);
}

// Every Paystack response has this envelope. `status` is a BOOLEAN here
// (Flutterwave used the string "success" — easy to get wrong in a port).
interface PsResponse<T> {
  status?: boolean;
  message?: string;
  data?: T;
}

async function call<T>(path: string, init?: RequestInit): Promise<PsResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
  });
  return (await res.json()) as PsResponse<T>;
}

/**
 * Starts a payment and returns the hosted checkout URL to send the buyer to.
 *
 * `reference` is OUR id and also the id we verify by later — one id across
 * both systems means a disputed charge is traceable without a lookup table.
 */
export async function startPayment(opts: {
  email: string;
  amountUsdCents: number;
  reference: string;
  redirectUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{ checkoutUrl: string; splitApplied: boolean; producerCents: number }> {
  const subaccount = env().PAYSTACK_PRODUCER_SUBACCOUNT;
  const producerCents = producerShareCents(opts.amountUsdCents);
  const platformCents = opts.amountUsdCents - producerCents;

  const data = await call<{ authorization_url?: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountUsdCents, // cents — Paystack's subunit
      currency: "USD",
      reference: opts.reference,
      // Paystack appends ?trxref=…&reference=… to this on the way back.
      callback_url: opts.redirectUrl,
      channels: ["card"],
      metadata: {
        ...(opts.metadata ?? {}),
        // Stamped on the transaction so a Paystack-side dispute can be
        // reconciled without reading our database.
        producer_share_cents: producerCents,
        platform_share_cents: platformCents,
      },
      // No subaccount configured yet: charge the full amount to the main
      // account. Refusing the sale instead would mean the shop cannot trade
      // until a payout account exists — the money is reconcilable, a lost
      // customer is not.
      ...(subaccount ? { subaccount, transaction_charge: platformCents } : {}),
    }),
  });

  if (!data.status || !data.data?.authorization_url) {
    throw new Error(data.message || "Could not start the payment");
  }
  return { checkoutUrl: data.data.authorization_url, splitApplied: Boolean(subaccount), producerCents };
}

export interface PsTransaction {
  status: "success" | "failed" | "pending";
  amountUsdCents: number | null;
  currency: string | null;
  raw: unknown;
}

/**
 * Asks Paystack what really happened. Never trust the browser's redirect —
 * anyone can type a reference into the address bar.
 */
export async function verifyPayment(reference: string): Promise<PsTransaction> {
  const data = await call<{ status?: string; amount?: number; currency?: string }>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );

  const tx = data.data;
  // "Transaction reference not found" comes back as status:false — the buyer
  // hasn't reached the card form yet. That is pending, not an error: the cart
  // polls this and a throw would break the loop.
  if (!data.status || !tx) {
    return { status: "pending", amountUsdCents: null, currency: null, raw: data };
  }

  // Paystack marks an initialized-but-unpaid transaction "abandoned" — the
  // buyer may still be typing their card, so it counts as pending too.
  const ps = String(tx.status || "").toLowerCase();
  const status = ps === "success" ? "success" : ps === "failed" || ps === "reversed" ? "failed" : "pending";

  // `amount` is already in cents: what we asked for, before Paystack's fee.
  const amount = Number(tx.amount);
  return {
    status,
    amountUsdCents: Number.isFinite(amount) ? amount : null,
    currency: tx.currency ?? null,
    raw: tx,
  };
}

/**
 * Webhook authenticity.
 *
 * Paystack SIGNS THE BODY: `x-paystack-signature` is the hex HMAC-SHA512 of
 * the raw request body, keyed with our secret key. So this must run on the
 * exact bytes received — parse the JSON first and re-stringify it, and the
 * signature no longer matches.
 *
 * `crypto.subtle.verify` does the comparison itself, in constant time, so no
 * hand-rolled byte loop is needed.
 */
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  // SHA-512 is 64 bytes = 128 hex chars. Anything else is not a signature.
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"]
  );
  // hex -> bytes, two characters per byte.
  const sig = new Uint8Array(signature.match(/../g)!.map((h) => parseInt(h, 16)));
  return crypto.subtle.verify("HMAC", key, sig, enc.encode(rawBody));
}
