/**
 * RATE LIMITING THAT ACTUALLY HOLDS ON WORKERS.
 *
 * The trap this replaces: an in-memory `Map` counter. It looks like it works,
 * passes every local test, and enforces nothing in production — because each
 * Cloudflare isolate has its own copy of that Map and isolates are created and
 * destroyed constantly. Shared limits need shared storage, so the counter is a
 * D1 row.
 *
 * Cost: one or two queries per limited request. Only the routes that can burn
 * money or spam a stranger's phone are limited, so that is fine.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/cf";
import { rateLimits } from "@/db/schema";

export interface LimitResult {
  ok: boolean;
  retryAfter?: number; // seconds
}

export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<LimitResult> {
  const d = db();
  const nowSec = Math.floor(Date.now() / 1000);

  const row = await d.select().from(rateLimits).where(eq(rateLimits.key, key)).get();

  // No record, or the window has expired: start a fresh one.
  if (!row || nowSec >= row.resetAt) {
    await d
      .insert(rateLimits)
      .values({ key, count: 1, resetAt: nowSec + windowSeconds })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: 1, resetAt: nowSec + windowSeconds },
      });
    return { ok: true };
  }

  if (row.count >= max) {
    return { ok: false, retryAfter: row.resetAt - nowSec };
  }

  // Increment in SQL, not `row.count + 1` in JS. Two requests that both read 4
  // would both write 5 and the fifth attempt would slip through; `count + 1`
  // makes the database do the arithmetic and the race disappears.
  await d
    .update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1` })
    .where(eq(rateLimits.key, key));

  return { ok: true };
}

/** The caller's IP, as Cloudflare reports it. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
