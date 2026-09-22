/**
 * THE LICENCE TABLE — transcribed from "Beat Licensing & Usage Terms
 * Specification" and treated as the single source of truth for the whole site.
 *
 * Prices, limits and delivered formats all live here. The catalogue, the beat
 * page, /licenses, checkout and the download route ALL read this one object, so
 * a tier cannot cost one thing on the page and another at checkout, and the
 * terms shown can never drift from the terms sold.
 *
 * WHY PRICING IS SITE-WIDE AND NOT PER BEAT:
 * the spec states one price per tier for the catalogue, not a price per beat.
 * Keeping it here means changing the MP3 tier is one edit, not an UPDATE across
 * every row — and it removes any chance of a beat being saved with a price that
 * contradicts the published terms sheet.
 *
 * Money is USD cents, like everywhere else in this app. Never a float.
 */

export const LICENSE_IDS = ["mp3", "wav", "unlimited", "trackout", "exclusive"] as const;
export type LicenseId = (typeof LICENSE_IDS)[number];

/** Which stored file a tier delivers. Maps to the R2 key columns on `beats`. */
export type DeliverableFormat = "mp3" | "wav" | "stems";

export interface License {
  id: LicenseId;
  name: string;
  /**
   * USD cents. `null` means the tier is NOT purchasable online — the spec marks
   * Exclusive as "Negotiation Only", so it is an enquiry, never an Add button.
   */
  priceCents: number | null;
  /** null = unlimited. Kept as null rather than Infinity so it serialises. */
  distributionCopies: number | null;
  audioStreams: number | null;
  /** Everything the buyer downloads at this tier, in the order shown. */
  formats: DeliverableFormat[];
  /** The rights rows, exactly as the spec words them. */
  rights: {
    musicRecording: string;
    distributeCopies: string;
    audioStreams: string;
    musicVideo: string;
    forProfitPerformances: string;
    radioBroadcasting: string;
  };
}

export const LICENSES: Record<LicenseId, License> = {
  mp3: {
    id: "mp3",
    name: "MP3 License",
    priceCents: 1999,
    distributionCopies: 5000,
    audioStreams: 50000,
    formats: ["mp3"],
    rights: {
      musicRecording: "Yes",
      distributeCopies: "5,000 Max",
      audioStreams: "50,000 Max",
      musicVideo: "Unlimited",
      forProfitPerformances: "Yes",
      radioBroadcasting: "Unlimited stations",
    },
  },
  wav: {
    id: "wav",
    name: "WAV + MP3 License",
    priceCents: 3599,
    distributionCopies: 7500,
    audioStreams: 100000,
    formats: ["wav", "mp3"],
    rights: {
      musicRecording: "Yes",
      distributeCopies: "7,500 Max",
      audioStreams: "100,000 Max",
      musicVideo: "Unlimited",
      forProfitPerformances: "Yes",
      radioBroadcasting: "Unlimited stations",
    },
  },
  unlimited: {
    id: "unlimited",
    name: "Unlimited License",
    priceCents: 6599,
    distributionCopies: null,
    audioStreams: null,
    formats: ["wav", "mp3"],
    rights: {
      musicRecording: "Yes",
      distributeCopies: "Unlimited",
      audioStreams: "Unlimited",
      musicVideo: "Unlimited",
      // The spec's page 1 is cut off below "Music Video Rights" for this tier
      // and Trackout. These two rows are carried down from WAV + MP3 because a
      // higher tier cannot grant FEWER rights than the one beneath it — but
      // they are the only two values on this page not read directly off the
      // document, so confirm them before printing the terms anywhere binding.
      forProfitPerformances: "Yes",
      radioBroadcasting: "Unlimited stations",
    },
  },
  trackout: {
    id: "trackout",
    name: "Trackout License",
    priceCents: 12000,
    distributionCopies: null,
    audioStreams: null,
    formats: ["stems", "wav", "mp3"],
    rights: {
      musicRecording: "Yes",
      distributeCopies: "Unlimited",
      audioStreams: "Unlimited",
      musicVideo: "Unlimited",
      forProfitPerformances: "Yes",
      radioBroadcasting: "Unlimited stations",
    },
  },
  exclusive: {
    id: "exclusive",
    name: "Exclusive License",
    // Negotiation Only — see `priceCents` above.
    priceCents: null,
    distributionCopies: null,
    audioStreams: null,
    formats: ["stems", "wav", "mp3"],
    rights: {
      musicRecording: "Yes",
      distributeCopies: "Unlimited",
      audioStreams: "Unlimited",
      musicVideo: "Unlimited",
      forProfitPerformances: "Yes",
      radioBroadcasting: "Unlimited stations",
    },
  },
};

/** Display order everywhere: cheapest first, exclusive last. */
export const LICENSE_ORDER: LicenseId[] = ["mp3", "wav", "unlimited", "trackout", "exclusive"];

export function isLicenseId(v: unknown): v is LicenseId {
  return typeof v === "string" && (LICENSE_IDS as readonly string[]).includes(v);
}

/** Purchasable online — i.e. everything except Exclusive. */
export function isPurchasable(id: LicenseId): boolean {
  return LICENSES[id].priceCents !== null;
}

/**
 * Can this beat actually be sold at this tier?
 *
 * A tier that delivers stems is unsellable on a beat with no stems uploaded —
 * taking the money and delivering nothing is the worst possible outcome, so the
 * check is on the FILE, not on the price.
 */
export function isAvailableFor(
  id: LicenseId,
  files: { hasMp3: boolean; hasWav: boolean; hasStems: boolean }
): boolean {
  if (!isPurchasable(id)) return false;
  return LICENSES[id].formats.every((f) =>
    f === "mp3" ? files.hasMp3 : f === "wav" ? files.hasWav : files.hasStems
  );
}

/** "Up to 5,000 copies" / "Unlimited" — one wording, used by every surface. */
export function copiesLabel(id: LicenseId): string {
  const n = LICENSES[id].distributionCopies;
  return n === null ? "Unlimited" : `Up to ${n.toLocaleString("en-US")} copies`;
}

export function streamsLabel(id: LicenseId): string {
  const n = LICENSES[id].audioStreams;
  return n === null ? "Unlimited" : `${n.toLocaleString("en-US")} streams`;
}

/** "Untagged MP3 + WAV" — the Audio Format column, built from `formats`. */
export function formatsLabel(id: LicenseId): string {
  const f = LICENSES[id].formats;
  const parts = f.map((x) => (x === "stems" ? "Full Stems" : x.toUpperCase()));
  return f.includes("stems") ? parts.join(" + ") : `Untagged ${parts.join(" + ")}`;
}
