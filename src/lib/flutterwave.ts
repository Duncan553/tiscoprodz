/**
 * FLUTTERWAVE — the only processor on this site.
 *
 * Hosted checkout: the buyer leaves for Flutterwave's page, pays by card there,
 * and comes back. We never see a card number, which keeps this site entirely out
 * of PCI scope. That is a legal reason not to build our own payment form, not a
 * technical one.
 *
 * Written with plain `fetch` and Web Crypto — no axios, no node:crypto. Not a
 * style choice: axios pulls in Node http internals and `crypto.createHmac` does
 * not exist in the Workers runtime.
 *
 * THE SITE CHARGES IN US DOLLARS. Beats are priced in USD in the database, so
 * charging dollars means no conversion sits between the price tag and the
 * payment page — the $19.99 on the beat row is the $19.99 Flutterwave asks for.
 * There is no second currency anywhere on this site: no KSh figure is shown,
 * derived or charged.
 *
 * Amounts here are MAJOR units (dollars, not cents) because that is what
 * Flutterwave's API takes. Everything else in the app is integer cents, so the
 * conversion happens here and nowhere else — see `toMajor`.
 */
import { env } from "@/lib/cf";

const BASE = "https://api.flutterwave.com/v3";

function secret(): string {
  const key = env().FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("Flutterwave is not configured");
  return key;
}

/**
 * THE REVENUE SPLIT.
 *
 * The producer keeps 90%, the platform keeps 10%. Flutterwave settles the
 * producer's share DIRECTLY to their own subaccount — the money never sits in
 * the platform's balance waiting to be forwarded, so there is no float, no
 * manual payout run, and no month where someone has to be chased.
 *
 * HOW FLUTTERWAVE MODELS THIS, because it is counter-intuitive:
 * the `subaccounts` array describes what the SUBACCOUNT receives, and the main
 * account keeps whatever is left. So to give the producer 90% you send a
 * subaccount entry for 90% of the charge, and the remaining 10% lands in the
 * platform account automatically. There is no "platform share" field.
 *
 * `transaction_charge_type: "flat_subaccount"` with an exact amount, not a
 * ratio. Ratios (`transaction_split_ratio`) only express coarse proportions
 * and cannot represent a real cart — a $139.99 order split 90/10 is
 * $125.99/$14.00, which no ratio of small integers gives you exactly.
 *
 * WHO BEARS FLUTTERWAVE'S FEE: `bearer: "subaccount"` would make the producer
 * absorb it on top of the 10%. This deliberately leaves the fee with the main
 * account, so the producer's 90% is 90% of the sticker price and the split is
 * the number they were promised.
 */
export const PRODUCER_SHARE = 0.9;

/** Cents -> the producer's cut, in cents. Rounded DOWN, never up. */
export function producerShareCents(totalCents: number): number {
  // floor, so rounding can never hand out more than was collected. The odd
  // cent stays with the platform rather than creating a shortfall.
  return Math.floor(totalCents * PRODUCER_SHARE);
}

/** True once a producer subaccount id has been configured. */
export function hasSplit(): boolean {
  return Boolean(env().FLUTTERWAVE_PRODUCER_SUBACCOUNT);
}

/** Cents -> dollars, the one place that division happens. */
function toMajor(cents: number): number {
  return Math.round(cents) / 100;
}

interface FlwResponse<T> {
  status?: string;
  message?: string;
  data?: T;
}

/**
 * Starts a payment and returns the hosted checkout URL to send the buyer to.
 *
 * `tx_ref` is OUR reference and also the id we verify by later — one id across
 * both systems means a disputed charge is traceable without a lookup table.
 */
export async function startPayment(opts: {
  email: string;
  amountUsdCents: number;
  reference: string;
  redirectUrl: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ checkoutUrl: string; splitApplied: boolean; producerCents: number }> {
  const subaccount = env().FLUTTERWAVE_PRODUCER_SUBACCOUNT;
  const producerCents = producerShareCents(opts.amountUsdCents);

  // No subaccount configured yet: charge the full amount to the main account
  // and record that no split was applied. Refusing the sale instead would mean
  // the shop cannot trade until a payout account exists, which is the wrong
  // trade — the money is reconcilable, a lost customer is not.
  const subaccounts = subaccount
    ? [
        {
          id: subaccount,
          transaction_charge_type: "flat_subaccount" as const,
          // What the SUBACCOUNT gets. The platform keeps the remainder.
          transaction_charge: toMajor(producerCents),
        },
      ]
    : [];
  const res = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: opts.reference,
      amount: toMajor(opts.amountUsdCents),
      currency: "USD",
      redirect_url: opts.redirectUrl,
      // Card only. A USD charge cannot settle over M-Pesa, which is a shilling
      // rail — listing mpesa here would show the buyer an option that fails at
      // the last step. Flutterwave handles the buyer's own currency conversion
      // on its side.
      payment_options: "card",
      customer: {
        email: opts.email,
        ...(opts.phone ? { phonenumber: opts.phone } : {}),
      },
      customizations: {
        title: "TISCOPRODZ",
        description: "Beat licence",
      },
      meta: {
        ...(opts.metadata ?? {}),
        // Stamped on the transaction so a Flutterwave-side dispute can be
        // reconciled without reading our database.
        producer_share_cents: producerCents,
        platform_share_cents: opts.amountUsdCents - producerCents,
      },
      ...(subaccounts.length ? { subaccounts } : {}),
    }),
  });

  const data = (await res.json()) as FlwResponse<{ link?: string }>;
  if (data.status !== "success" || !data.data?.link) {
    throw new Error(data.message || "Could not start the payment");
  }
  return {
    checkoutUrl: data.data.link,
    splitApplied: subaccounts.length > 0,
    producerCents,
  };
}

export interface FlwTransaction {
  /** Normalised: Flutterwave says "successful"; everything else maps to these. */
  status: "success" | "failed" | "pending";
  /** USD cents, converted back so callers never see a float. */
  amountUsdCents: number | null;
  currency: string | null;
  raw: unknown;
}

/**
 * Asks Flutterwave what really happened. Never trust the browser's redirect —
 * anyone can type `?status=successful` into the address bar.
 *
 * Verifying BY REFERENCE (not by Flutterwave's own transaction id) means the
 * cart only ever has to remember the one id it created.
 */
export async function verifyPayment(reference: string): Promise<FlwTransaction> {
  const res = await fetch(
    `${BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret()}` } }
  );

  const data = (await res.json()) as FlwResponse<{
    status?: string;
    amount?: number;
    amount_settled?: number;
    currency?: string;
  }>;

  const tx = data.data;
  // No transaction yet (the buyer is still on the hosted page) is "pending",
  // not an error — the cart polls this and a throw would break the loop.
  if (data.status !== "success" || !tx) {
    return { status: "pending", amountUsdCents: null, currency: null, raw: data };
  }

  const flw = String(tx.status || "").toLowerCase();
  const status = flw === "successful" ? "success" : flw === "failed" ? "failed" : "pending";

  // `amount` is what the buyer was charged; `amount_settled` is net of
  // Flutterwave's fee. We compare against what we ASKED for, so it has to be
  // `amount` — settled would always look short and flag every legitimate order.
  const amount = Number(tx.amount);

  return {
    status,
    amountUsdCents: Number.isFinite(amount) ? Math.round(amount * 100) : null,
    currency: tx.currency ?? null,
    raw: tx,
  };
}

/**
 * Webhook authenticity.
 *
 * Flutterwave does NOT sign the body. It sends a fixed shared secret in the
 * `verif-hash` header — whatever you typed into the dashboard's webhook settings.
 * So this is a secret comparison, not an HMAC.
 *
 * Still compared in constant time: `===` returns on the first wrong byte and
 * that timing difference is measurable across enough requests.
 */
export function verifyWebhookHash(received: string | null): boolean {
  const expected = env().FLUTTERWAVE_SECRET_HASH;
  if (!expected || !received) return false;
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return diff === 0;
}
