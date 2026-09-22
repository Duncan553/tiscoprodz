import { bucket, hasStorage } from "@/lib/cf";
import { isPublicKey } from "@/lib/storage";

/**
 * PUBLIC FILES — artwork and preview clips, straight out of R2.
 *
 * The bucket itself has no public URL, so this route is the only way anything
 * gets out of it. `isPublicKey` is the gate: the covers/ and previews/ prefixes
 * pass, mp3/ wav/ and stems/ never do. Without that check, guessing a key would
 * hand out the untagged master and there would be nothing left to sell.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO RANGE SUPPORT HERE. This is the interesting part, and it cost
 * an afternoon of a preview that silently refused to play.
 *
 * The obvious implementation — parse `Range`, ask R2 for the slice, return 206
 * with Content-Range and Content-Length — does not survive this stack. The
 * Worker streams every response body with `Transfer-Encoding: chunked` and
 * drops a hand-set Content-Length. Returning an exact ArrayBuffer instead of a
 * stream does not help; the length is still stripped on the way out.
 *
 * A **206 Partial Content with no Content-Length is malformed**, and Chrome's
 * media stack reacts to it in the worst possible way: it accepts the response,
 * never resolves a duration, and parks the <audio> element at readyState 0.
 * No error event. No console warning. The clip simply never plays, which is
 * indistinguishable from a corrupt file.
 *
 * A **200 with chunked encoding is perfectly legal** — only 206 needs a
 * definite length. So this route always answers 200 with the whole object, and
 * does NOT send `accept-ranges: bytes`. Browsers then buffer the clip and seek
 * inside it locally, which is the right behaviour for a preview anyway.
 *
 * The cost is real but small: previews are capped at 20MB by UPLOAD_RULES and
 * are typically a couple of MB, and `immutable` means the edge serves repeats
 * without the Worker waking at all. The private download route has the same
 * shape and needs no ranges either — it sends a file as an attachment.
 *
 * If ranges ever matter (long mixes, video), the fix is a custom R2 domain
 * serving the bucket directly, where Cloudflare handles ranges itself.
 * ---------------------------------------------------------------------------
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await params;
  const key = segments.join("/");

  // Storage not connected yet: 404 rather than a 503 JSON body, because this
  // route's callers are <img> and <video> elements, and they want a status, not
  // an explanation. The built-in hero background covers the visual gap.
  if (!hasStorage()) return new Response("Not found", { status: 404 });

  if (!isPublicKey(key)) {
    // 404, not 403. A 403 confirms the object exists, which is a free hint to
    // anyone probing for private keys.
    return new Response("Not found", { status: 404 });
  }

  const object = await bucket().get(key);
  if (!object || !object.body) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  // writeHttpMetadata replays the contentType R2 stored at upload time, so an
  // MP3 is served as audio/mpeg without this route keeping its own mime table.
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // The key contains a UUID, so an object at a given key never changes —
  // `immutable` lets Cloudflare's edge answer repeats without the Worker.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
