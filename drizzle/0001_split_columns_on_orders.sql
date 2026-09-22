-- Adds the revenue-split columns to `orders`.
--
-- WHY THIS EXISTS AS A SEPARATE MIGRATION: production was created from an
-- earlier generation of 0000 that predates the 90/10 split, so its `orders`
-- table has no producer_usd_cents, platform_usd_cents or split_applied. The
-- local database was recreated later and has them, which is exactly why this
-- never showed up in development — checkout worked locally and returned 500 on
-- production for every single purchase attempt.
--
-- DEFAULT 0 rather than NULL so the columns can be added to a table that
-- already holds rows: SQLite requires a non-null default for NOT NULL columns
-- added by ALTER TABLE. Any pre-existing order is therefore recorded as
-- "nothing split", which is true of them — they were taken before the split
-- existed, so their producer share is owed manually. That is precisely what the
-- earnings page's needsManualPayout figure is for.
ALTER TABLE orders ADD COLUMN producer_usd_cents integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN platform_usd_cents integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN split_applied integer NOT NULL DEFAULT 0;
