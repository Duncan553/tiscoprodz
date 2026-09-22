/**
 * WHAT R2 IS COSTING, and what it will cost.
 *
 * Cloudflare bills R2 on three things: GB stored per month, Class A operations
 * (writes) and Class B operations (reads). Egress is free, which is the whole
 * reason a beat store belongs on R2 rather than S3 — delivering a 100MB stems
 * pack costs nothing in bandwidth.
 *
 * THE RATES BELOW ARE A LOCAL ESTIMATE, NOT A BILL. Cloudflare's published
 * pricing changes, there is a free tier that this does not model, and the real
 * invoice is the one in the dashboard. What this module can say with certainty
 * is the BYTES — those are measured, not guessed — so the UI leads with GB and
 * treats the money as an estimate.
 */

/** USD cents per GB stored for a month. Check current R2 pricing before trusting. */
export const STORAGE_CENTS_PER_GB_MONTH = 1.5;

/** R2's free storage allowance, in GB. Below this the estimate is zero. */
export const FREE_STORAGE_GB = 10;

const GB = 1024 * 1024 * 1024;

export function toGb(bytes: number): number {
  return bytes / GB;
}

/** "1.4 GB" / "820 MB" / "12 KB" — a size a person can read at a glance. */
export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Estimated monthly storage cost in USD cents for a given stored size.
 * Only the part above the free allowance is charged.
 */
export function estimateMonthlyCostCents(storedBytes: number): number {
  const billableGb = Math.max(0, toGb(storedBytes) - FREE_STORAGE_GB);
  return Math.round(billableGb * STORAGE_CENTS_PER_GB_MONTH);
}

/** "2026-09" for right now, in UTC — the same key the uploads table stores. */
export function currentMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "September 2026" from "2026-09", for display. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
