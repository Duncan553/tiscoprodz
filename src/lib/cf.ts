/**
 * THE ONE DOOR TO CLOUDFLARE.
 *
 * On Workers there is no `process.env` for bindings — D1 and R2 arrive as live
 * objects on a per-request `env`. `getCloudflareContext()` is how the Next.js
 * adapter hands them over, and every server file in this app gets them here so
 * nothing else has to know the adapter exists.
 *
 * WHY THIS IS async-free: getCloudflareContext() has a sync form that works
 * inside a request. The async form exists for build-time code (generateStatic-
 * Params, etc.). Calling the sync form at module scope throws — so call these
 * INSIDE the handler, never at the top of the file.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

export interface Bindings {
  DB: D1Database;
  /**
   * OPTIONAL, and that is deliberate.
   *
   * R2 requires a payment method on the Cloudflare account before a bucket can
   * exist — even on the free tier. Workers and D1 do not. So the site can be
   * fully deployed and usable (landing page, licence terms, contact, admin
   * sign-in) before any card is added; only the FILE features wait.
   *
   * Typing it as possibly-undefined is what forces every call site to decide
   * what happens when storage is absent, instead of throwing a 500 that reads
   * like a bug.
   */
  R2?: R2Bucket;
  SITE_URL: string;
  ADMIN_EMAIL: string;
  // Secrets. Set in .dev.vars for `wrangler dev`, and with
  // `wrangler secret put <NAME>` for production.
  SESSION_SECRET: string;
  /** sk_test_… / sk_live_… — also the key that signs webhooks. */
  PAYSTACK_SECRET_KEY: string;
  /**
   * The producer's Paystack SUBACCOUNT code (looks like `ACCT_xxxx…`).
   * Optional: without it the sale still completes, it just all lands in the
   * main account and `split_applied` is recorded as 0 on the order.
   */
  PAYSTACK_PRODUCER_SUBACCOUNT?: string;
  /** LOCAL TESTING ONLY — see chargeCurrency() in src/lib/paystack.ts. */
  PAYSTACK_CURRENCY?: string;
  USD_TO_KES_FALLBACK?: string;
  USD_TO_KES_MARGIN?: string;
}

export function env(): Bindings {
  return getCloudflareContext().env as unknown as Bindings;
}

/** The query builder, typed against src/db/schema.ts. */
export function db(): DrizzleD1Database<typeof schema> {
  return drizzle(env().DB, { schema });
}

/** True once an R2 bucket is bound. */
export function hasStorage(): boolean {
  return Boolean(env().R2);
}

/**
 * The bucket, or a throw. Only call this behind a `hasStorage()` check or in a
 * route that has already returned `storageUnavailable()`.
 */
export function bucket(): R2Bucket {
  const b = env().R2;
  if (!b) {
    throw new Error(
      "R2 is not connected yet. Add a payment method to the Cloudflare account, " +
        "run `pnpm run r2:create`, then re-enable the r2_buckets binding in wrangler.jsonc."
    );
  }
  return b;
}

/**
 * The shared answer for a file route when storage is not connected.
 *
 * 503, not 500: this is a configuration state, not a fault, and the message
 * says exactly what unblocks it. A bare 500 here would send someone hunting
 * through logs for a bug that does not exist.
 */
export function storageUnavailable(): Response {
  return Response.json(
    {
      ok: false,
      message:
        "File storage isn't connected yet. Add a payment method to Cloudflare, create the R2 bucket, and this works immediately — nothing else changes.",
    },
    { status: 503 }
  );
}
