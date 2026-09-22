import { bucket, db, hasStorage, storageUnavailable } from "@/lib/cf";
import { uploads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { UPLOAD_RULES, isUploadKind, buildKey } from "@/lib/storage";
import { currentMonth } from "@/lib/usage";

/**
 * FILE UPLOAD — browser to R2, through the Worker, in one request.
 *
 * This is the piece Cloudflare makes simple. On Vercel a request body over
 * ~4.5MB is rejected at the edge before any code runs, so jst-beat had to mint
 * single-use signed upload tokens, push the bytes to storage from the browser,
 * then re-verify the stored object afterwards — three files and a whole trust
 * dance to work around a platform limit. Workers stream the body, so the file
 * goes into R2 right here and none of that exists.
 *
 * The server still decides the prefix and re-checks type and size, because the
 * client picked the file. That part is not a platform detail, it is the rule.
 *
 * Returns the R2 KEY. The caller sends that key to /api/admin/beats, which is
 * what puts it in a row.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Checked BEFORE reading the body: there is no sense streaming a 60MB WAV
  // across the network only to discover there is nowhere to put it.
  if (!hasStorage()) return storageUnavailable();

  const form = await req.formData();
  const kind = form.get("kind");
  const file = form.get("file");

  if (!isUploadKind(kind)) {
    return Response.json({ ok: false, message: "Unknown upload kind" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ ok: false, message: "No file" }, { status: 400 });
  }

  const rule = UPLOAD_RULES[kind];

  // A browser reports type from the extension, so this is a sanity check, not
  // proof of content. It is still worth doing: it catches the wrong file picked
  // by accident, which is the failure that actually happens.
  if (!rule.mimes.includes(file.type.toLowerCase())) {
    return Response.json(
      { ok: false, message: `Wrong file type for ${kind}. Allowed: ${rule.mimes.join(", ")}. Got: ${file.type || "unknown"}` },
      { status: 400 }
    );
  }
  if (file.size <= 0 || file.size > rule.maxBytes) {
    return Response.json(
      { ok: false, message: `${(file.size / 1048576).toFixed(1)}MB is outside the limit for ${kind} (max ${Math.round(rule.maxBytes / 1048576)}MB).` },
      { status: 400 }
    );
  }

  const key = buildKey(kind, file.name);

  await bucket().put(key, file.stream(), {
    // Stored on the object so /api/media can replay it — that route never needs
    // its own extension-to-mime table.
    httpMetadata: { contentType: file.type },
  });

  // Record it for the usage panel. AFTER the put, so a failed upload never
  // counts toward the month's bill — and if this insert fails the file is still
  // safely stored, which is the right way round for the two to break.
  await db().insert(uploads).values({
    id: crypto.randomUUID(),
    objectKey: key,
    kind,
    bytes: file.size,
    month: currentMonth(),
  });

  return Response.json({ ok: true, key, size: file.size });
}
