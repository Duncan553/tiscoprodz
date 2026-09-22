import { authorizeOrder } from "@/lib/orders";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { LICENSES, isLicenseId, type DeliverableFormat } from "@/lib/licenses";
import type { DownloadLink } from "@/types/beat";

/**
 * "What did I buy?" — the download links for a paid order.
 *
 * ONE LINE FANS OUT INTO SEVERAL LINKS. A licence tier delivers a set of
 * formats, not one file: WAV + MP3 is two downloads, Trackout is three. The
 * tier table decides which, so this route never hardcodes that mapping.
 *
 * This returns URLs, not bytes. Each points at /api/download/file with the same
 * reference+token, which is where the file actually comes from — so the cart can
 * render a list of buttons without holding hundreds of megabytes in memory.
 *
 * The links carry the token in the query string so they work in a plain
 * `<a download>`. That makes the token the whole secret, which is why it is 32
 * random bytes released only after payment.
 */
const FORMAT_LABEL: Record<DeliverableFormat, string> = {
  mp3: "MP3",
  wav: "WAV",
  stems: "Stems",
};

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limit = await rateLimit(`download:ip:${ip}`, 30, 60);
  if (!limit.ok) {
    return Response.json({ ok: false, message: "Too many requests" }, { status: 429 });
  }

  const url = new URL(req.url);
  const reference = url.searchParams.get("reference");
  const token = url.searchParams.get("token");

  const auth = await authorizeOrder(reference, token);
  // One answer for "no such order", "not paid" and "wrong token". Telling them
  // apart hands a prober a way to confirm which references exist.
  if (!auth) {
    return Response.json({ ok: false, message: "Not available" }, { status: 403 });
  }

  const downloads: DownloadLink[] = [];

  for (const line of auth.lines) {
    // An order written before a tier was renamed could carry an id that no
    // longer exists. Skip it rather than throwing away the rest of the order.
    if (!isLicenseId(line.license)) continue;
    const license = LICENSES[line.license];

    for (const format of license.formats) {
      downloads.push({
        beatId: line.beat_id,
        title: line.title,
        license: license.name,
        format: FORMAT_LABEL[format],
        url:
          `/api/download/file?reference=${encodeURIComponent(reference!)}` +
          `&token=${encodeURIComponent(token!)}` +
          `&beat=${encodeURIComponent(line.beat_id)}` +
          `&license=${encodeURIComponent(line.license)}` +
          `&format=${encodeURIComponent(format)}`,
      });
    }
  }

  return Response.json({ ok: true, downloads });
}
