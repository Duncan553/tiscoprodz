"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBytes, monthLabel } from "@/lib/usage";
import { formatUsd } from "@/lib/money";

/**
 * R2 USAGE — how much went up each month, and what is stored now.
 *
 * The BYTES are measured, so they lead. The money is an estimate from a rate in
 * src/lib/usage.ts and is labelled as one — Cloudflare's dashboard is the bill,
 * and quoting a confident figure that disagrees with the real invoice is worse
 * than showing no figure at all.
 */
interface Usage {
  currentMonth: string;
  byMonth: Array<{ month: string; bytes: number; files: number }>;
  stored: { bytes: number; files: number };
  byKind: Array<{ kind: string; bytes: number }>;
  estimatedMonthlyCostCents: number;
}

export function UsagePanel() {
  const [usage, setUsage] = useState<Usage | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/usage");
    const data = (await res.json()) as { ok: boolean } & Usage;
    if (data.ok) setUsage(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!usage) {
    return (
      <div className="card p-5">
        <h2 className="font-display font-bold text-lg">Storage &amp; uploads</h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-3)" }}>Loading…</p>
      </div>
    );
  }

  const thisMonth = usage.byMonth.find((m) => m.month === usage.currentMonth);
  // The widest month sets the bar scale, so the tallest bar is always full —
  // scaling against a fixed ceiling makes every bar a stub in a quiet month.
  const peak = Math.max(1, ...usage.byMonth.map((m) => m.bytes));

  return (
    <div className="card p-5">
      <h2 className="font-display font-bold text-lg">Storage &amp; uploads</h2>
      <p className="text-sm mt-1 mb-5" style={{ color: "var(--text-2)" }}>
        What&apos;s in Cloudflare R2. Egress is free — you only pay for what is
        stored, so deleting an old beat is what lowers the bill.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Uploaded this month" value={formatBytes(thisMonth?.bytes ?? 0)} sub={`${thisMonth?.files ?? 0} files`} />
        <Stat label="Stored now" value={formatBytes(usage.stored.bytes)} sub={`${usage.stored.files} files`} />
        <Stat
          label="Est. monthly cost"
          value={formatUsd(usage.estimatedMonthlyCostCents)}
          sub="estimate, not a bill"
        />
      </div>

      {usage.byMonth.length > 0 && (
        <>
          <p className="label mb-2">Uploaded by month</p>
          <ul className="space-y-1.5 mb-6">
            {usage.byMonth.slice(0, 12).map((m) => (
              <li key={m.month} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate" style={{ color: "var(--text-2)" }}>
                  {monthLabel(m.month)}
                </span>
                {/* scaleX rather than width: transform-only, so a list of these
                    costs no layout. See the motion skill. */}
                <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <span
                    className="block h-full origin-left rounded-full"
                    style={{
                      background: "var(--accent-hot)",
                      transform: `scaleX(${m.bytes / peak})`,
                    }}
                  />
                </span>
                <span className="w-20 text-right tabular-nums shrink-0" style={{ color: "var(--text-1)" }}>
                  {formatBytes(m.bytes)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {usage.byKind.length > 0 && (
        <>
          <p className="label mb-2">Stored by type</p>
          <div className="flex flex-wrap gap-2">
            {[...usage.byKind]
              .sort((a, b) => b.bytes - a.bytes)
              .map((k) => (
                <span key={k.kind} className="chip">
                  {k.kind} · {formatBytes(k.bytes)}
                </span>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{label}</p>
      <p className="font-display font-bold text-xl mt-1 tabular-nums">{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{sub}</p>
    </div>
  );
}
