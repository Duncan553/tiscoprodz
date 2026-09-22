/**
 * THE CART — browser only, persisted to localStorage.
 *
 * Nothing here is trusted by the server. The cart sends beat ids and licences
 * to /api/checkout, and the server looks every price up again from D1. That is
 * the whole reason a client-side cart is safe: the number in localStorage is a
 * display convenience, never an instruction about what to charge.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicBeat, CartLine } from "@/types/beat";
import { type LicenseId, LICENSES, isAvailableFor } from "@/lib/licenses";

interface CartState {
  lines: CartLine[];
  add: (beat: PublicBeat, license: LicenseId) => void;
  remove: (beatId: string, license?: LicenseId) => void;
  clear: () => void;
  /** USD cents total, priced from the tier table. */
  totalUsdCents: () => number;
  has: (beatId: string, license?: LicenseId) => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],

      add: (beat, license) => {
        const { lines } = get();

        // Identity is beat + LICENCE, not beat alone. Match on the beat only
        // and buying the MP3 tier would make every other tier of that beat
        // unaddable — one beat could then only ever sell one licence, which is
        // a silent revenue bug.
        if (lines.some((l) => l.beat.id === beat.id && l.license === license)) return;

        // Refuse a tier this beat cannot actually deliver (e.g. Trackout with
        // no stems uploaded) rather than adding a line checkout will reject.
        // Exclusive is not purchasable at all, and isAvailableFor knows it.
        if (!isAvailableFor(license, beat)) return;

        set({ lines: [...lines, { beat, license }] });
      },

      // Without a licence, drop every licence of that beat. With one, drop only
      // that line — a cart legitimately holds the WAV and the stems together.
      remove: (beatId, license) =>
        set({
          lines: get().lines.filter((l) =>
            license ? !(l.beat.id === beatId && l.license === license) : l.beat.id !== beatId
          ),
        }),

      clear: () => set({ lines: [] }),

      // Priced from the tier table at read time, never from anything stored in
      // localStorage — a persisted price is a price an attacker can edit, and a
      // stale one the day a tier changes.
      totalUsdCents: () =>
        get().lines.reduce((sum, l) => sum + (LICENSES[l.license].priceCents ?? 0), 0),

      has: (beatId, license) =>
        get().lines.some((l) => l.beat.id === beatId && (license ? l.license === license : true)),
    }),
    {
      name: "tiscoprodz-cart",
      // v2 replaced the two-tier wav/stems model with the five licence tiers
      // from the spec. A v1 cart holds licence ids that no longer exist.
      version: 2,
      // A cart persisted under an older shape can't be safely reinterpreted —
      // drop it rather than charge someone a price parsed out of stale JSON.
      migrate: () => ({ lines: [] }) as never,
    }
  )
);
