import type { MetadataRoute } from "next";
import { listPublicBeats } from "@/lib/beats";
import { env } from "@/lib/cf";

/**
 * THE SITEMAP — how Google finds the beat pages.
 *
 * Without this, a crawler only discovers a beat page by following a link from
 * /beats. That works, but it is slow and it gives the crawler no hint about
 * which pages matter or how often they change. Every beat is a page that could
 * rank for its own name, so every beat belongs in here.
 *
 * Built from the database rather than a static list, so a beat uploaded through
 * the admin is in the sitemap the moment it is published — nobody has to
 * remember to update anything.
 *
 * `force-dynamic` because the beat list comes from D1 at request time; a
 * statically generated sitemap would freeze whatever existed at build.
 */
export const dynamic = "force-dynamic";

function origin(): string {
  // Follows SITE_URL, so the day a real domain is attached the sitemap moves
  // with it instead of advertising the old host to Google.
  return env().SITE_URL || "https://tiscoprodz.tisco.workers.dev";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = origin();
  const beats = await listPublicBeats();

  // The fixed pages. `priority` is a hint about relative importance WITHIN this
  // site only — it says nothing to Google about ranking against other sites.
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/beats`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/licenses`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // /cart and /admin are deliberately absent: one is per-visitor state with
  // nothing to index, the other is a password form.
  for (const b of beats) {
    pages.push({
      url: `${base}/beats/${b.id}`,
      lastModified: b.createdAt ? new Date(b.createdAt * 1000) : undefined,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  return pages;
}
