"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCartStore } from "@/stores/useCartStore";
import { formatUsd } from "@/lib/money";
import { LICENSES } from "@/lib/licenses";
import { usePromo } from "@/hooks/usePromo";
import { applyPromo, promoLabel, oneAwayLabel } from "@/lib/promo";
import type { DownloadLink } from "@/types/beat";

/**
 * CHECKOUT.
 *
 * One path, because Paystack hosts the payment page itself:
 *
 *   POST /api/checkout  ->  full redirect to Paystack's card page  ->  they
 *   come back to /cart?reference=…  ->  the mount effect below verifies that
 *   reference SERVER-SIDE  ->  on "paid" we get a download token  ->  GET
 *   /api/download for the links.
 *
 * The charge is in US DOLLARS, and dollars are the only currency on the site.
 *
 * Arriving back on /cart proves nothing — anyone can type that URL. Only our
 * own verify route, which asks Paystack directly, decides whether an order is paid.
 *
 * Polling still exists because the redirect can land before Paystack has
 * finished settling on its side.
 *
 * The cart survives the redirect because it lives in localStorage. The download
 * token does NOT get persisted anywhere — it is held in React state for this
 * visit only, so it never sits in a browser store waiting to be read.
 */
export default function CartPage() {
  // useSearchParams() needs a Suspense boundary in the App Router, or the build
  // fails outright. This wrapper is that boundary.
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto p-6" style={{ color: "var(--text-3)" }}>Loading…</div>}>
      <CartInner />
    </Suspense>
  );
}

type Stage = "cart" | "waiting" | "paid" | "failed" | "flagged";

function CartInner() {
  const { lines, remove, clear } = useCartStore();
  const promo = usePromo();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");

  const [stage, setStage] = useState<Stage>("cart");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [downloads, setDownloads] = useState<DownloadLink[]>([]);
  // Holds the interval id so it can be cleared from the unmount cleanup. Without
  // this, navigating away mid-payment leaves a timer polling forever.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Priced from the licence table, exactly like the server does. Nothing about
  // a price is read out of localStorage.
  const priceOf = (licenseId: keyof typeof LICENSES) => LICENSES[licenseId].priceCents ?? 0;
  // The SAME applyPromo the server charges with (src/lib/promo.ts). Running a
  // second, "close enough" calculation here is how a cart ends up promising a
  // discount checkout doesn't give.
  const { subtotalCents, discountCents, totalCents, freeCount, oneAwayFrom } = applyPromo(
    lines.map((l) => ({ license: l.license, usdCents: priceOf(l.license) })),
    promo
  );
  const totalUsd = totalCents;
  const label = promoLabel(promo);

  const loadDownloads = useCallback(async (ref: string, token: string) => {
    const res = await fetch(`/api/download?reference=${encodeURIComponent(ref)}&token=${encodeURIComponent(token)}`);
    const data = (await res.json()) as { ok: boolean; downloads?: DownloadLink[] };
    if (data.ok) setDownloads(data.downloads || []);
  }, []);

  const checkOnce = useCallback(
    async (ref: string): Promise<Stage> => {
      const res = await fetch(`/api/checkout/verify?reference=${encodeURIComponent(ref)}`);
      const data = (await res.json()) as {
        status?: Stage | "pending";
        downloadToken?: string;
        amountUsdCents?: number;
        message?: string;
      };

      if (data.status === "paid" && data.downloadToken) {
        setStage("paid");
        setMessage(`Paid — ${formatUsd(data.amountUsdCents ?? 0)} received.`);
        // The cart is emptied only HERE, once payment is confirmed. Clearing it
        // when the request is sent would lose the order if the payment failed.
        clear();
        await loadDownloads(ref, data.downloadToken);
        return "paid";
      }
      if (data.status === "failed") {
        setStage("failed");
        setMessage("That payment failed or was cancelled.");
        return "failed";
      }
      if (data.status === "flagged") {
        setStage("flagged");
        setMessage(data.message || "This payment needs a manual check. Keep your reference.");
        return "flagged";
      }
      return "waiting";
    },
    [clear, loadDownloads]
  );

  const startPolling = useCallback(
    (ref: string) => {
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        const result = await checkOnce(ref).catch(() => "waiting" as Stage);
        // Stop on any settled state, or after two minutes. An interval with no
        // exit runs until the tab closes.
        if (result !== "waiting" || attempts >= 24) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (result === "waiting" && attempts >= 24) {
            setMessage("Still not confirmed. Check your email from Paystack, then hit Check again.");
          }
        }
      }, 5000);
    },
    [checkOnce]
  );

  // Coming back from Paystack: ?reference= is on the URL (?tx_ref= is from
  // the Flutterwave era, kept so an in-flight return still lands). Verify it immediately instead of leaving the buyer on an empty
  // cart wondering whether their money went anywhere.
  useEffect(() => {
    const returned = searchParams.get("reference") || searchParams.get("tx_ref");
    if (!returned) return;
    setReference(returned);
    setStage("waiting");
    setMessage("Confirming your payment…");
    checkOnce(returned).then((r) => { if (r === "waiting") startPolling(returned); });
    // Deliberately runs once, on mount: re-running it on every searchParams
    // change would re-verify on any unrelated query-string edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          // Only ids and licences. No prices — the server re-prices everything
          // from D1, which is why a tampered cart cannot change what it pays.
          items: lines.map((l) => ({ beat_id: l.beat.id, license: l.license })),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        reference?: string;
        checkoutUrl?: string;
      };
      if (!data.ok || !data.checkoutUrl) {
        throw new Error(data.message || "Payment could not start.");
      }

      // Leave the site. Everything after this happens on Paystack's page,
      // and they send the buyer back to /cart?reference=… when it's done.
      window.location.assign(data.checkoutUrl);
      return;
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // The cart is localStorage-backed, so the server renders it empty. Waiting for
  // mount avoids a hydration mismatch — and avoids flashing "your cart is empty"
  // at someone whose cart is not.
  if (!mounted) {
    return <div className="max-w-2xl mx-auto p-6" style={{ color: "var(--text-3)" }}>Loading…</div>;
  }

  // ---------------------------------------------------------------- paid ----
  if (stage === "paid") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="eyebrow mb-2">Order {reference}</p>
        <h1 style={{ fontSize: "var(--text-h1)" }} className="font-display font-extrabold mb-2">Paid. Here are your files.</h1>
        <p className="mb-6" style={{ color: "var(--text-2)" }}>{message}</p>

        <div className="space-y-2">
          {downloads.map((d) => (
            <a
              key={`${d.beatId}-${d.license}-${d.format}`}
              href={d.url}
              className="card p-4 flex items-center justify-between gap-4"
            >
              <span className="min-w-0">
                <span className="block font-display font-bold truncate" style={{ color: "var(--text-1)" }}>
                  {d.title} <span style={{ color: "var(--accent-hot)" }}>· {d.format}</span>
                </span>
                <span className="block text-xs" style={{ color: "var(--text-3)" }}>{d.license}</span>
              </span>
              <span className="btn shrink-0">Download</span>
            </a>
          ))}
        </div>

        <p className="text-xs mt-6" style={{ color: "var(--text-3)" }}>
          Save these files now. Keep the reference <strong>{reference}</strong> — it&apos;s how we find
          your order if anything goes wrong.
        </p>
        <Link href="/beats" className="btn btn-ghost mt-6">Back to the beats</Link>
      </div>
    );
  }

  // ------------------------------------------------------------ waiting ----
  if (stage === "waiting" || stage === "failed" || stage === "flagged") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="eyebrow mb-2">Order {reference}</p>
        <h1 style={{ fontSize: "var(--text-h2)" }} className="font-display font-extrabold mb-3">
          {stage === "waiting" ? "Confirming your payment" : stage === "failed" ? "Payment didn't go through" : "Needs a manual check"}
        </h1>
        <p className="mb-6" style={{ color: "var(--text-2)" }}>{message}</p>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => checkOnce(reference)} className="btn">Check again</button>
          {stage !== "waiting" && (
            <button onClick={() => { setStage("cart"); setMessage(""); }} className="btn btn-ghost">
              Back to checkout
            </button>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- cart ----
  if (lines.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 style={{ fontSize: "var(--text-h2)" }} className="font-display font-extrabold mb-2">Your cart is empty</h1>
        <p className="mb-6" style={{ color: "var(--text-2)" }}>Pick a licence on any beat and it&apos;ll show up here.</p>
        <Link href="/beats" className="btn">Browse the beats</Link>
      </div>
    );
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canPay = emailValid && !busy;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 style={{ fontSize: "var(--text-h2)" }} className="font-display font-extrabold mb-1">Checkout</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-3)" }}>
        {lines.length} item{lines.length === 1 ? "" : "s"}
      </p>

      {label && (
        <div
          className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
          style={{ background: "var(--accent-soft)", border: "1px solid var(--line-2)" }}
        >
          <span className="pill shrink-0">Offer</span>
          <span className="text-sm">
            {label}.{" "}
            {/* Naming the TIER matters: "add one more licence" would send
                someone to add a cheap MP3 expecting it free when their odd
                licence is a Trackout, and pairing never crosses tiers. */}
            {oneAwayLabel(oneAwayFrom) && (
              <span style={{ color: "var(--accent-hot)" }}>{oneAwayLabel(oneAwayFrom)}</span>
            )}
          </span>
        </div>
      )}

      <div className="card overflow-hidden mb-6">
        {lines.map((l) => (
          <div
            key={`${l.beat.id}-${l.license}`}
            className="flex items-center gap-3 p-4 border-b last:border-b-0"
            style={{ borderColor: "var(--line)" }}
          >
            <img src={l.beat.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate" style={{ color: "var(--text-1)" }}>{l.beat.title}</p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>{LICENSES[l.license].name}</p>
            </div>
            <p className="font-bold text-sm tabular-nums shrink-0" style={{ color: "var(--text-1)" }}>
              {formatUsd(priceOf(l.license))}
            </p>
            <button
              onClick={() => remove(l.beat.id, l.license)}
              className="text-xs shrink-0 cursor-pointer underline"
              style={{ color: "var(--text-3)" }}
            >
              Remove
            </button>
          </div>
        ))}

        <div
          className="flex items-center justify-between px-4 py-4 border-t"
          style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
        >
          <span className="font-display font-bold">Total</span>
          <span className="text-right">
            {discountCents > 0 && (
              <>
                {/* The struck-through subtotal is what makes a discount FEEL
                    like one. A total that is simply lower than expected reads
                    as a pricing error. */}
                <span className="block text-xs tabular-nums line-through" style={{ color: "var(--text-3)" }}>
                  {formatUsd(subtotalCents)}
                </span>
                <span className="block text-xs tabular-nums" style={{ color: "var(--accent-hot)" }}>
                  −{formatUsd(discountCents)} · {freeCount} free
                </span>
              </>
            )}
            <span className="block font-display font-bold text-lg tabular-nums">{formatUsd(totalUsd)}</span>
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email (for the receipt)</label>
          <input
            id="email" type="email" inputMode="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" className="field"
          />
        </div>

        <p className="text-xs" style={{ color: "var(--text-3)" }}>
          You&apos;ll pay by card on Paystack&apos;s secure page, in US dollars.
          We never see your card details.
        </p>

        {message && <p className="text-sm" style={{ color: "var(--accent-hot)" }}>{message}</p>}

        <button onClick={pay} disabled={!canPay} className="btn w-full">
          {busy ? "Taking you to checkout…" : `Pay ${formatUsd(totalUsd)}`}
        </button>
      </div>
    </div>
  );
}
