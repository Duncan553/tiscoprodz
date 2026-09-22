import Link from "next/link";
import { listPublicBeats } from "@/lib/beats";
import { BeatRow } from "@/components/BeatRow";
import { HeroSlider } from "@/components/hero/HeroSlider";
import { SplitText } from "@/components/SplitText";

/**
 * The landing page.
 *
 * A SERVER COMPONENT that reads D1 directly — no /api call, no loading state.
 * On Cloudflare the database is a binding on the same request, so the visitor
 * gets finished HTML with the beats already in it.
 *
 * HeroSlider is the only client component here. Keeping it leaf-level means the
 * animation library never drags the rest of the page out of server rendering.
 */
export const dynamic = "force-dynamic";

/**
 * How many beats the landing page teases. Three, not five.
 *
 * At five it was showing the ENTIRE catalogue, so "Fresh off the board" and
 * "All beats" were the same list and the section promised novelty it did not
 * have. A teaser has to be a subset or it is just the catalogue with a
 * different heading.
 */
const LATEST_COUNT = 3;

export default async function HomePage() {
  const beats = await listPublicBeats();
  const latest = beats.slice(0, LATEST_COUNT);

  /**
   * Only worth showing when there is genuinely more behind it. With three or
   * fewer beats in total the teaser IS the catalogue, and a "See all" link that
   * leads to the same rows is a dead end — better to send people straight to
   * the catalogue from the hero.
   */
  const showLatest = beats.length > LATEST_COUNT;

  return (
    <div>
      <HeroSlider />

      {showLatest && (
        <section className="max-w-6xl mx-auto px-4 pb-14">
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="eyebrow mb-1">Latest</p>
              <SplitText
                text="Fresh off the board"
                as="h2"
                style={{ fontSize: "var(--text-h2)" }}
                className="font-display"
              />
            </div>
            <Link href="/beats" className="text-sm underline tap inline-flex items-center" style={{ color: "var(--accent-hot)" }}>
              See all {beats.length}
            </Link>
          </div>
          <div className="space-y-2 stagger">
            {latest.map((beat) => (
              <BeatRow key={beat.id} beat={beat} />
            ))}
          </div>
        </section>
      )}

      {/* ---- how it works ------------------------------------------------
          The five licence cards used to sit above this. They were moved to
          /licenses, where the full comparison table and the rights breakdown
          already live — the landing page's job is to get someone listening,
          not to make them read a pricing matrix before they have heard a beat.
          Step 02 below links to them instead. */}
      <section className="max-w-6xl mx-auto px-4 pb-10">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            ["01", "Listen", "Every beat streams a tagged preview. No account, no email."],
            ["02", "Pick a licence", "Five tiers decide what you get and how far you can take it."],
            ["03", "Download", "Pay by card and the untagged files are on the next screen."],
          ].map(([n, title, body]) => (
            <div key={n} className="card p-5">
              <p className="font-display text-2xl" style={{ color: "var(--accent-hot)" }}>*{n}</p>
              <h3 className="font-display text-lg mt-2">{title}</h3>
              <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>{body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <Link href="/beats" className="btn">Browse the beats</Link>
          <Link href="/licenses" className="btn btn-ghost">See the five licences</Link>
        </div>
      </section>

    </div>
  );
}
