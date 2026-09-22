import type { LicenseId } from "@/lib/licenses";

/**
 * THE PUBLIC SHAPE OF A BEAT.
 *
 * This is deliberately NOT the database row. The row carries `mp3Key`,
 * `wavKey` and `stemsKey` — the paths to the untagged files someone has to pay
 * for — and if the type the pages used were the row type, one careless
 * `select()` would ship those keys to the browser in the HTML.
 *
 * Having a separate type means the compiler stops that: a page that tries to
 * read `beat.masterKey` does not build. lib/beats.ts holds the one function
 * that converts row -> this, and it is the only place the two shapes meet.
 */
export interface PublicBeat {
  id: string;
  title: string;
  bpm: number;
  musicalKey: string;
  genre: string;
  tags: string[];

  coverUrl: string;   // /api/media/covers/...
  previewUrl: string; // /api/media/previews/... — the tagged clip

  /**
   * WHICH DELIVERABLES EXIST for this beat — not the keys themselves, just
   * whether each one is there. That is all the browser needs in order to know
   * which licence tiers to offer, and it leaks nothing.
   */
  hasMp3: boolean;
  hasWav: boolean;
  hasStems: boolean;

  createdAt: number; // unix seconds
}

/** One line of a cart. The price is looked up from the tier, never stored here. */
export interface CartLine {
  beat: PublicBeat;
  license: LicenseId;
}

/** What /api/download returns once an order is paid. */
export interface DownloadLink {
  beatId: string;
  title: string;
  license: string;
  /** "MP3" / "WAV" / "Stems" — a tier delivers several files, one link each. */
  format: string;
  url: string;
}
