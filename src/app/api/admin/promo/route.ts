import { requireAdmin } from "@/lib/auth";
import { getPromo, setPromo } from "@/lib/promo-server";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return Response.json({ ok: true, promo: await getPromo() });
}

/** Flip the promotion. One boolean, one click. */
export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json()) as { bogo?: unknown };
  const promo = { bogo: Boolean(body.bogo) };
  await setPromo(promo);
  return Response.json({ ok: true, promo });
}
