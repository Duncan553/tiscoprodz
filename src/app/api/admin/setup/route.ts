import { eq } from "drizzle-orm";
import { db } from "@/lib/cf";
import { settings } from "@/db/schema";
import { setPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";

/**
 * FIRST-RUN ONLY: sets the admin password.
 *
 * It works exactly once. The moment a hash exists in `settings` this route
 * refuses every request, so it cannot be used to reset the password later — a
 * public "set the admin password" endpoint would hand the site to whoever found
 * it. Changing the password afterwards means deleting that settings row with
 * wrangler, deliberately, from a machine that has the D1 credentials.
 *
 *   curl -X POST https://your-site/api/admin/setup \
 *        -H 'content-type: application/json' \
 *        -d '{"password":"something long"}'
 */
export async function POST(req: Request) {
  const existing = await db()
    .select()
    .from(settings)
    .where(eq(settings.key, "admin_password_hash"))
    .get();

  if (existing) {
    return Response.json(
      { ok: false, message: "Already set up. Delete the admin_password_hash row to redo this." },
      { status: 409 }
    );
  }

  const { password } = (await req.json()) as { password?: string };
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { ok: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  await setPassword(password);
  return Response.json({ ok: true, message: "Password set. Sign in at /admin." });
}
