/**
 * R2 — the file side of the site.
 *
 * ONE bucket, four prefixes, and the prefix is the security model:
 *
 *   covers/   public   artwork
 *   previews/ public   the tagged clip anyone can stream
 *   mp3/      PRIVATE  the untagged MP3 — every licence tier delivers it
 *   wav/      PRIVATE  the untagged WAV — WAV+MP3 and above
 *   stems/    PRIVATE  the stems ZIP — Trackout and Exclusive only
 *
 * Nothing in R2 is reachable from the internet on its own — the bucket has no
 * public URL. Every byte leaves through a route in this app, which is what makes
 * "private" mean something. Public files go out through /api/media (cached hard
 * at the edge); private files only through /api/download, and only with a token
 * that a paid order handed over.
 *
 * WHY THERE IS NO SIGNED-UPLOAD DANCE HERE:
 * jst-beat needed two extra files (upload-kinds.ts, client-upload.ts) and a
 * token-minting route because Vercel rejects any request body over ~4.5MB before
 * the handler runs — a 40MB WAV could never reach the server. Workers have no
 * such cap; the request body streams straight into R2. The upload route posts
 * the file directly, and all of that machinery disappears. Same safety, because
 * the server still decides the prefix and re-checks type and size.
 */

export type UploadKind = "cover" | "preview" | "mp3" | "wav" | "stems";

const MB = 1024 * 1024;
const AUDIO = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp3", "audio/wave"];
const IMAGES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ZIP = ["application/zip", "application/x-zip-compressed"];

export interface UploadRule {
  prefix: string;
  visibility: "public" | "private";
  mimes: string[];
  maxBytes: number;
}

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  cover:   { prefix: "covers",   visibility: "public",  mimes: IMAGES, maxBytes: 10 * MB },
  // 100MB, same as the WAV deliverable — a preview exported straight out of the
  // DAW as a WAV is routinely 20-40MB and there is no reason to block that at
  // upload time. But see PREVIEW_ADVISORY_BYTES below: big is allowed, not free.
  preview: { prefix: "previews", visibility: "public",  mimes: AUDIO,  maxBytes: 100 * MB },
  // The three deliverables, each in its own prefix. Separate prefixes (rather
  // than one "masters/") are what let /api/download/file prove that the file it
  // is about to send really is the format the licence tier allows.
  mp3:     { prefix: "mp3",      visibility: "private", mimes: AUDIO,  maxBytes: 50 * MB },
  wav:     { prefix: "wav",      visibility: "private", mimes: AUDIO,  maxBytes: 100 * MB },
  // 100MB is the Worker request-body ceiling on the paid plan's normal path.
  // A bigger stems pack needs R2 multipart upload from the browser — noted in
  // README so it's a known limit, not a surprise on upload day.
  stems:   { prefix: "stems",    visibility: "private", mimes: ZIP,    maxBytes: 100 * MB },
};

/**
 * Above this, a preview is worth a WARNING but not a refusal.
 *
 * The preview is the one PUBLIC audio file: every visitor downloads it in full
 * before they hear a note, on whatever connection they have. A 3MB MP3 starts
 * playing almost immediately; a 21MB WAV is the same few seconds of music at
 * seven times the wait and seven times the data, and it is data the LISTENER
 * pays for.
 *
 * It is the producer's call, so this only advises. The private deliverables
 * (mp3/wav/stems) have no such advisory — those are downloaded once, by someone
 * who has already paid, and should absolutely be full quality.
 */
export const PREVIEW_ADVISORY_BYTES = 6 * MB;

export function isUploadKind(v: unknown): v is UploadKind {
  return typeof v === "string" && v in UPLOAD_RULES;
}

/**
 * Strips anything that could climb out of its prefix ("../", slashes) or upset
 * R2's key parser. Applied on the SERVER, so a crafted filename from the browser
 * cannot place a file anywhere but where we decided.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/_{2,}/g, "_").slice(-80) || "file";
}

/** The key the server chooses. The client contributes only a cleaned filename. */
export function buildKey(kind: UploadKind, filename: string): string {
  return `${UPLOAD_RULES[kind].prefix}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

/** Is this key one the public route is allowed to serve? Prefix decides. */
export function isPublicKey(key: string): boolean {
  return Object.values(UPLOAD_RULES).some(
    (r) => r.visibility === "public" && key.startsWith(`${r.prefix}/`)
  );
}

/** The URL the browser uses for a public object. */
export function mediaUrl(key: string): string {
  return `/api/media/${key}`;
}
