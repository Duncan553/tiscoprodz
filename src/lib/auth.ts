/**
 * ADMIN AUTH — one account, no user table, no Supabase.
 *
 * There is exactly one person who may upload a beat. So the whole thing is:
 *
 *   password  ->  PBKDF2 hash compared against a hash stored in `settings`
 *   success   ->  a signed JWT in an HttpOnly cookie
 *   every write route -> verifies that cookie before touching the database
 *
 * WHY PBKDF2 AND NOT bcrypt: Workers have Web Crypto, not Node's native
 * bindings, so bcrypt/argon2 can't run here. PBKDF2-SHA256 at 150k iterations
 * is in Web Crypto and is genuinely fine for a single admin password.
 *
 * WHY HttpOnly COOKIE AND NOT localStorage: jst-beat kept its session token in
 * localStorage, which meant every API call had to attach an Authorization
 * header by hand and any injected script could read the token. A cookie the
 * browser attaches automatically and JavaScript cannot read removes both
 * problems — and it's why nothing in this app builds an auth header.
 */
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, env } from "@/lib/cf";
import { settings } from "@/db/schema";

const COOKIE = "tsc_session";
/**
 * 100,000 — the PLATFORM MAXIMUM, not a tuning choice.
 *
 * Workers refuses anything higher:
 *   NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
 *   supported (requested 150000).
 *
 * This shipped as 150,000 and broke ONLY in production — the local runtime
 * accepted it, so every test passed and the deployed site could not hash a
 * password at all. Admin login and first-run setup both returned 500 with the
 * real reason visible only in `wrangler tail`.
 *
 * Do not raise this. If stronger hashing is ever needed, the answer is a
 * different KDF, not more iterations.
 */
const PBKDF2_ITERATIONS = 100_000;
export const HASH_KEY = "admin_password_hash";

/**
 * The floor for the admin password.
 *
 * Six is LOW on purpose — the owner chose a short numeric code, and it is his
 * catalogue. What makes that survivable is not the length, it is the throttle:
 * /api/admin/login limits attempts per IP AND globally (see rate-limit usage
 * there), so a six-digit space cannot be walked through no matter how many
 * addresses an attacker has. Raise this the moment a longer password is used;
 * the throttle is a mitigation, not a substitute.
 */
export const MIN_PASSWORD_LENGTH = 6;

/** Weak enough to be worth warning about in the UI, without blocking it. */
export function isWeakPassword(password: string): boolean {
  return password.length < 12 || /^\d+$/.test(password);
}

// --- password hashing -------------------------------------------------------

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
}

/** Produces the `salt$hash` string stored in settings. Used by the seed script. */
export async function hashPassword(password: string): Promise<string> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return `${salt}$${await pbkdf2(password, salt)}`;
}

/**
 * Constant-time compare. A plain `===` on hashes leaks timing information —
 * it returns early on the first differing byte, and the difference is
 * measurable over enough requests. This always walks the whole string.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(password: string): Promise<boolean> {
  const row = await db().select().from(settings).where(eq(settings.key, HASH_KEY)).get();
  if (!row) return false; // no password set yet — refuse, never allow-by-default
  const [salt, expected] = row.value.split("$");
  if (!salt || !expected) return false;
  return timingSafeEqual(await pbkdf2(password, salt), expected);
}

/**
 * Changes the password. Requires the CURRENT one even though the caller already
 * holds a valid session — a session cookie left open on a borrowed laptop
 * should not be enough to lock the owner out of his own catalogue.
 */
export async function changePassword(current: string, next: string): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (!(await checkPassword(current))) {
    return { ok: false, message: "Current password is wrong." };
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (next === current) {
    return { ok: false, message: "That is the same password." };
  }
  await setPassword(next);
  return { ok: true };
}

export async function setPassword(password: string): Promise<void> {
  const value = await hashPassword(password);
  const nowSec = Math.floor(Date.now() / 1000);
  await db()
    .insert(settings)
    .values({ key: HASH_KEY, value, updatedAt: nowSec })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: nowSec } });
}

// --- session ----------------------------------------------------------------

/** Minimum bytes for an HS256 signing key — anything shorter is brute-forceable. */
const MIN_SECRET_LENGTH = 32;

function secret(): Uint8Array {
  const s = env().SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  // Fail loudly rather than signing sessions with a weak key. A short secret
  // still produces a valid-looking JWT, so nothing would ever surface the
  // problem — the site would just be forgeable. `openssl rand -hex 32`.
  if (s.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET is too short (${s.length} chars). Use at least ${MIN_SECRET_LENGTH}: openssl rand -hex 32`
    );
  }
  return new TextEncoder().encode(s);
}

export async function createSession(): Promise<void> {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,   // JavaScript cannot read it — XSS can't steal the session
    secure: true,     // HTTPS only
    sameSite: "lax",  // survives the Paystack redirect back to /cart
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** True only for a cookie this server signed and that hasn't expired. */
export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false; // bad signature, expired, or tampered — all the same answer
  }
}

/** Guard for write routes. Returns a 401 Response, or null when allowed. */
export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
