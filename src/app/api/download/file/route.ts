import { eq } from "drizzle-orm";
import { db, bucket, hasStorage } from "@/lib/cf";
import { beats } from "@/db/schema";
import { authorizeOrder } from "@/lib/orders";
import { sanitizeFilename } from "@/lib/storage";
import { LICENSES, isLicenseId, type DeliverableFormat } from "@/lib/licenses";

/**
 * THE BYTES. The only route in the app that reads a private R2 prefix.
 *
 * It streams the object through the Worker rather than redirecting to R2,
 * because the bucket has no public URL at all — that is deliberate. A presigned
 * R2 URL would keep working for its whole lifetime even after we wanted it to
 * stop; here, revoking access is one UPDATE on the order row.
 *
 * THREE checks, in this order. The last two are the ones people forget:
 *   1. is this order paid, and is the token right?
 *   2. does this order actually include this beat AND this licence tier?
 *   3. does that TIER include the format being requested?
 *
 * Without (2), any paid order becomes a key to the whole catalogue by editing
 * the query string. Without (3), a $19.99 MP3 licence downloads the stems.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference");
  const token = url.searchParams.get("token");
  const beatId = url.searchParams.get("beat");
  const licenseId = url.searchParams.get("license");
  const format = url.searchParams.get("format") as DeliverableFormat | null;

  if (!hasStorage()) {
    return new Response("Downloads aren't available yet — contact support.", { status: 503 });
  }

  const auth = await authorizeOrder(reference, token);
  if (!auth || !beatId || !isLicenseId(licenseId) || !format) {
    return new Response("Not available", { status: 403 });
  }

  // Check (2): this exact beat + tier has to be a line on THIS order.
  const bought = auth.lines.some((l) => l.beat_id === beatId && l.license === licenseId);
  if (!bought) return new Response("Not available", { status: 403 });

  // Check (3): the tier has to include this format.
  const license = LICENSES[licenseId];
  if (!license.formats.includes(format)) {
    return new Response("Not available", { status: 403 });
  }

  const beat = await db().select().from(beats).where(eq(beats.id, beatId)).get();
  if (!beat) return new Response("Not found", { status: 404 });

  const key =
    format === "stems" ? beat.stemsKey : format === "wav" ? beat.wavKey : beat.mp3Key;
  if (!key) return new Response("File missing — contact support", { status: 404 });

  const object = await bucket().get(key);
  if (!object) {
    // The row points at an object that isn't there. Worth logging loudly: a
    // paying customer is stuck and only the log will say why.
    console.error(`[download] R2 object missing for beat ${beatId} (${key})`);
    return new Response("File missing — contact support", { status: 404 });
  }

  const ext = key.split(".").pop() || "bin";
  const filename = sanitizeFilename(`${beat.title}-${format}.${ext}`);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  // `attachment` makes the browser save it instead of trying to play an 80MB
  // WAV in a tab.
  headers.set("content-disposition", `attachment; filename="${filename}"`);
  // Never cached anywhere: this response is authorised per request, and a shared
  // cache holding it would serve the file to the next person on that edge.
  headers.set("cache-control", "private, no-store");

  return new Response(object.body, { headers });
}
