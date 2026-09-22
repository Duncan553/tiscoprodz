/**
 * THE WHOLE DATABASE. Four tables, and that's the site.
 *
 * This is Drizzle's schema: TypeScript that describes SQLite tables. Two things
 * come out of it — the SQL migration (`pnpm run db:generate`) and the types the
 * queries are checked against. One file, so the shape can never disagree with
 * the code that reads it.
 *
 * D1 is SQLite. Two consequences worth knowing before reading further:
 *
 *   1. There is no native boolean, no native timestamp and no JSON column.
 *      Booleans are 0/1 integers, times are unix seconds, JSON is text.
 *   2. MONEY IS NEVER A FLOAT. Every price and amount below is an INTEGER of
 *      minor units (cents). 0.1 + 0.2 !== 0.3 in binary floating point, and
 *      a catalogue that quietly rounds a cent per sale is a real bug you only
 *      find in the settlement statement.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/** Unix seconds — one helper so no table invents its own time format. */
const now = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// beats — the catalogue
// ---------------------------------------------------------------------------
export const beats = sqliteTable(
  "beats",
  {
    id: text("id").primaryKey(),

    title: text("title").notNull(),
    bpm: integer("bpm").notNull(),
    musicalKey: text("musical_key").notNull(), // `key` is reserved-ish in SQL; avoid the fight
    genre: text("genre").notNull(),
    // Comma-separated. A tags table would be correct and is overkill for a
    // catalogue one person types by hand — this is filtered in the browser.
    tags: text("tags").notNull().default(""),

    // --- files, as R2 object keys (NOT urls) -------------------------------
    // Keys, not urls, because the same key is served two different ways: public
    // art through a cached route, private files through a one-time token. A
    // stored url would bake one of those choices into the row forever.
    coverKey: text("cover_key").notNull(),     // public  — covers/...
    previewKey: text("preview_key").notNull(), // public  — previews/... (tagged clip)

    // The three deliverables. Which ones a buyer receives is decided by their
    // LICENCE TIER, not by the beat — see src/lib/licenses.ts. The MP3 is
    // required because every tier delivers it; WAV and stems are nullable, and
    // their absence is what makes the higher tiers unavailable on that beat.
    mp3Key: text("mp3_key").notNull(),   // PRIVATE — untagged MP3
    wavKey: text("wav_key"),             // PRIVATE — untagged WAV
    stemsKey: text("stems_key"),         // PRIVATE — stems ZIP

    // --- price -------------------------------------------------------------
    // THERE IS NO PRICE ON A BEAT. The licensing spec sets one price per TIER
    // for the whole catalogue, so prices live in src/lib/licenses.ts. Keeping
    // them off the row means a beat can never be saved at a price that
    // contradicts the published terms sheet.

    // Drafts exist so a beat can be uploaded, previewed, and priced before the
    // public can buy it. Every public read filters on this.
    published: integer("published").notNull().default(0),

    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    // The catalogue query is "published beats, newest first" — this index is
    // exactly that, so SQLite never sorts the whole table to answer it.
    index("beats_published_created_idx").on(t.published, t.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// orders — one row per checkout attempt
// ---------------------------------------------------------------------------
export const orders = sqliteTable(
  "orders",
  {
    // Our own reference, also the Paystack transaction reference. Format:
    // TSC-<ms>-<random>. One id across both systems means a disputed charge is
    // traceable without a lookup table.
    reference: text("reference").primaryKey(),

    email: text("email").notNull(),
    phone: text("phone").notNull().default(""), // empty for card — Paystack collects it

    // THE AMOUNT CHARGED, in USD cents, AFTER any discount. Recomputed
    // server-side from the licence table; the browser's number is never
    // trusted. There is no second currency column — see src/lib/money.ts.
    amountUsdCents: integer("amount_usd_cents").notNull(),

    // What the order would have cost at list price, and what the promotion took
    // off. Both stored because "why is this $19.99 when the lines add to $39.98"
    // is a question that gets asked months later, and the answer has to survive
    // the promotion being switched off in the meantime.
    subtotalUsdCents: integer("subtotal_usd_cents").notNull(),
    discountUsdCents: integer("discount_usd_cents").notNull().default(0),

    // THE SPLIT, recorded per order. The producer's 90% is settled directly to
    // their Flutterwave subaccount, so this is not an instruction — it is the
    // record of what was instructed, kept because the share can be changed and
    // an old order must still explain itself.
    producerUsdCents: integer("producer_usd_cents").notNull().default(0),
    platformUsdCents: integer("platform_usd_cents").notNull().default(0),
    // 0 when no subaccount was configured and the whole amount landed in the
    // main account — those orders need a manual payout, and this is how you
    // find them.
    splitApplied: integer("split_applied").notNull().default(0),

    // JSON array of verified lines: [{ beat_id, title, license, usd_cents }]
    // Frozen at purchase time on purpose — re-pricing a beat next month must not
    // rewrite what someone already paid.
    items: text("items").notNull(),

    // pending -> paid | failed | flagged.
    // `flagged` means Paystack reported a different amount than we recorded:
    // it's paid, but nobody gets files until a human looks at it.
    status: text("status").notNull().default("pending"),

    // THE DOWNLOAD KEY. jst-beat gated downloads on the reference alone, which
    // is a timestamp plus three random digits — guessable. This is 32 random
    // bytes, handed to the buyer only after verification says "success".
    downloadToken: text("download_token").notNull(),

    processorData: text("processor_data"), // raw verify/webhook payload, for audit
    createdAt: integer("created_at").notNull().$defaultFn(now),
    paidAt: integer("paid_at"),
  },
  (t) => [index("orders_status_idx").on(t.status, t.createdAt)]
);

// ---------------------------------------------------------------------------
// rate_limits — abuse control that survives Cloudflare's isolates
// ---------------------------------------------------------------------------
// jst-beat kept counters in a module-level `Map`. On one long-lived Node server
// that works. On Workers your request may hit a brand-new isolate in a
// different city, so the Map is empty and the limit is simply not enforced.
// A shared counter has to live in shared storage — this table.
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),      // e.g. "checkout:phone:0712345678"
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(), // unix seconds
});

// ---------------------------------------------------------------------------
// uploads — what went into R2, and when
// ---------------------------------------------------------------------------
// R2 bills on GB STORED per month plus the number of operations. Cloudflare's
// own dashboard reports that for the bucket, but it cannot answer "how much did
// I add in September" — and that is the number a producer actually wants when
// deciding whether to keep uploading 100MB WAVs.
//
// One row per uploaded object. Cheap to write (one INSERT per upload, and an
// upload is already a network transfer), and it makes both questions answerable
// with a single GROUP BY: how much went up this month, and how much is stored
// in total.
export const uploads = sqliteTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    /** The R2 key. Also how a row is matched when a beat is deleted. */
    objectKey: text("object_key").notNull(),
    /** cover | preview | mp3 | wav | stems — see src/lib/storage.ts */
    kind: text("kind").notNull(),
    bytes: integer("bytes").notNull(),
    /** "2026-09". Stored as text so the GROUP BY needs no date functions —
     *  SQLite has no date type, and a month key is what every query wants. */
    month: text("month").notNull(),
    /** Set when the object is removed from R2, so storage totals can exclude it
     *  while the upload itself still counts toward the month it happened in. */
    deletedAt: integer("deleted_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("uploads_month_idx").on(t.month)]
);

// ---------------------------------------------------------------------------
// settings — the one-row key/value table
// ---------------------------------------------------------------------------
// Holds things the producer changes without a deploy: the admin password hash,
// and whether the buy-one-get-one promotion is running. A table rather than env
// vars because env vars need a redeploy to change and cannot be written from a
// route — and a promotion has to be switchable in one click.
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

export type Upload = typeof uploads.$inferSelect;
export type Beat = typeof beats.$inferSelect;
export type NewBeat = typeof beats.$inferInsert;
export type Order = typeof orders.$inferSelect;
