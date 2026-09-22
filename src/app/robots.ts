import type { MetadataRoute } from "next";
import { env } from "@/lib/cf";

/**
 * ROBOTS — replaces the default file Cloudflare was serving.
 *
 * That default was a block of "content signal" boilerplate about AI training.
 * It blocked nothing and, more importantly, pointed at no sitemap, so a crawler
 * arriving at the root had no map of the site.
 *
 * What is disallowed here is disallowed because indexing it is useless or
 * harmful, not because it is secret — robots.txt is a public request, not a
 * security control. /admin is protected by a password either way; keeping it
 * out of the index just stops a login form appearing in search results.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = env().SITE_URL || "https://tiscoprodz.tisco.workers.dev";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",      // a password form; nothing to index
        "/api/",       // JSON endpoints, and /api/download is token-gated
        "/cart",       // per-visitor state, different for everyone
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
