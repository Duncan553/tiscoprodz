import Link from "next/link";
import { formatUsd } from "@/lib/money";
import { SplitText } from "@/components/SplitText";
import {
  LICENSES,
  LICENSE_ORDER,
  copiesLabel,
  streamsLabel,
  formatsLabel,
} from "@/lib/licenses";

/**
 * USAGE TERMS & LICENCE COMPARISON — the reference sheet, on the site.
 *
 * Every figure is read from src/lib/licenses.ts, the same object the beat page
 * and checkout use. That is the whole point of this page existing as code
 * rather than as typed-out copy: the terms published here CANNOT drift from the
 * terms being sold, because there is only one place either can change.
 *
 * A server component with no client JS at all — it is a table of static facts.
 */
export const metadata = {
  title: "Licences",
  description: "Usage terms and licence comparison for every beat on TISCOPRODZ.",
};

/** The rights rows, in the order the spec lists them. */
const RIGHTS_ROWS = [
  ["Used for music recording", "musicRecording"],
  ["Distribute copies", "distributeCopies"],
  ["Online audio streams", "audioStreams"],
  ["Music video rights", "musicVideo"],
  ["For-profit performances", "forProfitPerformances"],
  ["Radio broadcasting", "radioBroadcasting"],
] as const;

export default function LicensesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <p className="eyebrow mb-2">Usage terms</p>
      <SplitText
        text="Licence comparison"
        as="h1"
        style={{ fontSize: "var(--text-h1)" }}
        className="font-display font-extrabold mb-2"
      />
      <p className="mb-10 max-w-[58ch]" style={{ color: "var(--text-2)" }}>
        What each licence lets you do. Every beat is sold under these same terms,
        in US dollars.
      </p>

      {/* ---- comparison table ------------------------------------------- */}
      {/* overflow-x-auto, not a shrinking table: five columns of numbers cannot
          usefully compress onto a 360px phone, and a horizontal scroll keeps
          every row aligned instead of reflowing into unreadable stacks. */}
      {/* The scroll is invisible on a phone: you see two and a half columns and
          nothing tells you the other two exist. On the page that sells the
          licences, that is the difference between comparing tiers and not. The
          hint says so in words, and only on the screens where it is true. */}
      <p className="text-xs mb-2 sm:hidden" style={{ color: "var(--text-3)" }}>
        Swipe the table sideways to see every column — or read the same figures
        as cards below.
      </p>
      <div className="card overflow-x-auto mb-14 table-scroll">
        <table className="w-full text-sm" style={{ minWidth: "46rem" }}>
          <caption className="sr-only">Licence tiers, limits and formats</caption>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th scope="col" className="text-left font-semibold px-4 py-3">Licence tier</th>
              <th scope="col" className="text-left font-semibold px-4 py-3">Distribution limit</th>
              <th scope="col" className="text-left font-semibold px-4 py-3">Online audio streams</th>
              <th scope="col" className="text-left font-semibold px-4 py-3">Audio format</th>
            </tr>
          </thead>
          <tbody>
            {LICENSE_ORDER.map((id) => {
              const l = LICENSES[id];
              return (
                <tr key={id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <th scope="row" className="text-left px-4 py-3.5 font-semibold" style={{ color: "var(--text-1)" }}>
                    {l.name}
                    <span className="block text-xs font-normal mt-0.5" style={{ color: "var(--text-3)" }}>
                      {l.priceCents === null ? "Negotiation only" : formatUsd(l.priceCents)}
                    </span>
                  </th>
                  <td className="px-4 py-3.5">
                    {l.distributionCopies === null
                      ? <span className="pill">Unlimited</span>
                      : copiesLabel(id)}
                  </td>
                  <td className="px-4 py-3.5">
                    {l.audioStreams === null
                      ? <span className="pill">Unlimited</span>
                      : streamsLabel(id)}
                  </td>
                  <td className="px-4 py-3.5" style={{ color: "var(--text-2)" }}>{formatsLabel(id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---- per-tier rights -------------------------------------------- */}
      <SplitText
        text="Usage rights by tier"
        as="h2"
        style={{ fontSize: "var(--text-h2)" }}
        className="font-display font-bold mb-5"
      />

      <div className="grid sm:grid-cols-2 gap-4">
        {LICENSE_ORDER.map((id) => {
          const l = LICENSES[id];
          return (
            <div key={id} className="card p-5">
              <div className="flex items-baseline justify-between gap-3 pb-3 mb-3 border-b" style={{ borderColor: "var(--line)" }}>
                <h3 className="font-display font-bold text-lg">{l.name}</h3>
                <span className="text-sm tabular-nums shrink-0" style={{ color: "var(--accent-hot)" }}>
                  {l.priceCents === null ? "Negotiation" : formatUsd(l.priceCents)}
                </span>
              </div>

              <dl className="space-y-2 text-sm">
                {RIGHTS_ROWS.map(([label, key]) => (
                  <div key={key} className="flex items-baseline justify-between gap-4">
                    <dt style={{ color: "var(--text-3)" }}>{label}</dt>
                    {/* The dotted leader is what makes a two-column list of
                        facts readable — without it the eye loses the row on the
                        way across. */}
                    <span aria-hidden="true" className="flex-1 border-b border-dotted self-center" style={{ borderColor: "var(--line)" }} />
                    <dd className="text-right font-semibold shrink-0" style={{ color: "var(--text-1)" }}>
                      {l.rights[key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      <p className="text-xs mt-10 max-w-[62ch]" style={{ color: "var(--text-3)" }}>
        Exclusive licences are agreed case by case — the beat is removed from sale
        once one is signed. For anything not covered here, ask before you release.
      </p>

      <Link href="/beats" className="btn mt-8">Browse the beats</Link>
    </div>
  );
}
