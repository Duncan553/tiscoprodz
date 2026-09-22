"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUsd } from "@/lib/money";

interface Earnings {
  producerSharePct: number;
  splitConfigured: boolean;
  totals: { orders: number; grossCents: number; producerCents: number; platformCents: number; discountedCents: number };
  needsManualPayout: { orders: number; owedCents: number };
  flagged: number;
  recent: Array<{
    reference: string; email: string; amountUsdCents: number;
    producerUsdCents: number; platformUsdCents: number;
    splitApplied: number; status: string; createdAt: number;
  }>;
}

export function EarningsPanel() {
  const [data, setData] = useState<Earnings | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/earnings");
    const j = (await res.json()) as { ok: boolean } & Earnings;
    if (j.ok) setData(j);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <div className="card p-5">
        <h2 className="font-display text-lg">Earnings</h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-3)" }}>Loading…</p>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="card p-5">
      <h2 className="font-display text-lg">Earnings</h2>
      <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-2)" }}>
        Paid orders only — a cart that reached the payment page and stopped is not
        revenue. Producer keeps <strong>{data.producerSharePct}%</strong>, settled
        straight to their own Flutterwave account.
      </p>

      {/* The most important thing on this panel is whether the split is even
          wired up. Without a subaccount every sale lands in one account and
          somebody has to pay the producer by hand. */}
      {!data.splitConfigured && (
        <div
          className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ background: "var(--surface-3)", border: "1px solid var(--line-2)" }}
        >
          <strong>No producer subaccount set.</strong> Sales still go through, but the
          whole amount lands in the main account and the {data.producerSharePct}% has
          to be sent manually. Set <code>FLUTTERWAVE_PRODUCER_SUBACCOUNT</code> to fix.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Paid orders" value={String(t.orders)} />
        <Stat label="Gross" value={formatUsd(t.grossCents)} />
        <Stat label={`Producer ${data.producerSharePct}%`} value={formatUsd(t.producerCents)} accent />
        <Stat label="Platform" value={formatUsd(t.platformCents)} />
      </div>

      {data.needsManualPayout.orders > 0 && (
        <p className="text-sm mb-4" style={{ color: "var(--accent-hot)" }}>
          {data.needsManualPayout.orders} paid order
          {data.needsManualPayout.orders === 1 ? "" : "s"} went through without a split —{" "}
          <strong>{formatUsd(data.needsManualPayout.owedCents)}</strong> still owed to the producer.
        </p>
      )}
      {data.flagged > 0 && (
        <p className="text-sm mb-4" style={{ color: "var(--accent-hot)" }}>
          {data.flagged} order{data.flagged === 1 ? "" : "s"} flagged for manual review —
          paid, but no files released.
        </p>
      )}

      {data.recent.length > 0 && (
        <>
          <p className="label mb-2">Recent orders</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "34rem" }}>
              <thead>
                <tr style={{ color: "var(--text-3)" }}>
                  <th className="text-left font-normal pb-2">Reference</th>
                  <th className="text-left font-normal pb-2">Status</th>
                  <th className="text-right font-normal pb-2">Paid</th>
                  <th className="text-right font-normal pb-2">Producer</th>
                  <th className="text-right font-normal pb-2">Split</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((o) => (
                  <tr key={o.reference} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="py-2 font-mono text-xs">{o.reference.slice(0, 18)}</td>
                    <td className="py-2">
                      <span
                        className="chip"
                        style={o.status === "paid" ? { color: "var(--text-1)" } : undefined}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatUsd(o.amountUsdCents)}</td>
                    <td className="py-2 text-right tabular-nums">{formatUsd(o.producerUsdCents)}</td>
                    <td className="py-2 text-right">{o.splitApplied ? "auto" : "manual"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{label}</p>
      <p
        className="font-display text-xl mt-1 tabular-nums"
        style={accent ? { color: "var(--accent-hot)" } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
