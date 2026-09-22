import { requireAdmin, changePassword, isWeakPassword } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Change the admin password.
 *
 * Two gates, not one: a valid session AND the current password. The session
 * alone is not enough — an unattended logged-in browser should not be able to
 * change the credential and lock the owner out.
 *
 * Rate limited as well, because "guess the current password" is the same attack
 * as the login form wearing a different hat.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const limit = await rateLimit(`pwchange:ip:${clientIp(req)}`, 5, 15 * 60);
  if (!limit.ok) {
    return Response.json(
      { ok: false, message: "Too many attempts. Wait a few minutes." },
      { status: 429 }
    );
  }

  const body = (await req.json()) as { current?: string; next?: string };
  const current = String(body.current || "");
  const next = String(body.next || "");

  const result = await changePassword(current, next);
  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: 400 });
  }

  // The warning is advisory and travels with the success — the change is done
  // either way. Refusing a weak password the owner deliberately chose would
  // just mean he stops using the feature.
  return Response.json({
    ok: true,
    weak: isWeakPassword(next),
  });
}
