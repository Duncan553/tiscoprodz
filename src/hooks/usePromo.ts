"use client";

import { useEffect, useState } from "react";
import { PROMO_OFF, type PromoState } from "@/lib/promo";

/**
 * Is a promotion running?
 *
 * Shared module-level cache with an `inflight` promise, so a page with the cart
 * badge and the cart body both asking makes ONE request, not two.
 *
 * This is for DISPLAY ONLY. /api/checkout reads the promotion itself and
 * recomputes the discount, so a stale value here can make the cart briefly show
 * list price — it can never make the customer pay the wrong amount.
 */
let cached: PromoState | null = null;
let inflight: Promise<PromoState> | null = null;

function fetchPromo(): Promise<PromoState> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/promo")
      .then((r) => r.json() as Promise<PromoState>)
      .then((p) => {
        cached = { bogo: Boolean(p?.bogo) };
        return cached;
      })
      .catch(() => PROMO_OFF)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function usePromo(): PromoState {
  const [promo, setPromo] = useState<PromoState>(cached ?? PROMO_OFF);

  useEffect(() => {
    let alive = true;
    fetchPromo().then((p) => { if (alive) setPromo(p); });
    return () => { alive = false; };
  }, []);

  return promo;
}
