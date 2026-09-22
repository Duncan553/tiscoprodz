import { checkPassword, createSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * One password, one door. THE RATE LIMIT IS THE REAL DEFENCE — PBKDF2 makes each
 * guess cost something, but it does not stop a password from eventually being
 * walked through.
 *
 * TWO limits, and the second is the one that matters here:
 *
 *   per IP     8 / 15 min — stops one machine hammering the form
 *   GLOBAL    40 / 15 min — stops a botnet doing the same from 500 addresses
 *
 * A per-IP limit alone is close to useless against anyone renting proxies. The
 * global cap is what makes a short password survivable: at 40 tries per quarter
 * hour, a six-digit space takes over six years to exhaust. The trade-off is
 * honest — a sustained attack can lock the owner out of his own login for
 * fifteen minutes at a time, and that is much the better failure.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`login:ip:${clientIp(req)}`, 8, 15 * 60);
  if (!limit.ok) {
    return Response.json(
      { ok: false, message: "Too many attempts. Wait a few minutes." },
      { status: 429 }
    );
  }

  const global = await rateLimit("login:global", 40, 15 * 60);
  if (!global.ok) {
    return Response.json(
      { ok: false, message: "Too many attempts across the site. Try again shortly." },
      { status: 429 }
    );
  }

  const { password } = (await req.json()) as { password?: string };
  if (!password || !(await checkPassword(password))) {
    // Deliberately vague. "Wrong password" vs "no account" is information.
    return Response.json({ ok: false, message: "Wrong password." }, { status: 401 });
  }

  await createSession();
  return Response.json({ ok: true });
}
