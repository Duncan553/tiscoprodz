import { listPublicBeats } from "@/lib/beats";
import { Catalogue } from "@/components/Catalogue";
import { LICENSES } from "@/lib/licenses";
import { formatUsd } from "@/lib/money";
import { SplitText } from "@/components/SplitText";

export const dynamic = "force-dynamic";

export const metadata = { title: "All beats" };

export default async function BeatsPage() {
  // Read on the server, hand the whole list to a client component that owns the
  // search box. See components/Catalogue.tsx for why the split sits here.
  const beats = await listPublicBeats();

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <p className="eyebrow mb-2">Catalogue</p>
      <SplitText
        text="All beats"
        as="h1"
        style={{ fontSize: "var(--text-h1)" }}
        className="font-display font-extrabold mb-1"
      />
      {/* The price lives HERE, once, because it is the same for every beat —
          see the note in BeatRow about why a per-row price column was noise. */}
      <p className="mb-8" style={{ color: "var(--text-2)" }}>
        {beats.length} beat{beats.length === 1 ? "" : "s"} · every licence from{" "}
        <span style={{ color: "var(--text-1)" }}>{formatUsd(LICENSES.mp3.priceCents!)}</span>
      </p>

      <Catalogue beats={beats} />
    </div>
  );
}
