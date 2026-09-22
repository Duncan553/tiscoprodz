import type { NextConfig } from "next";

/**
 * SECURITY HEADERS.
 *
 * Applied to every response. These are the ones that are pure win — they cost
 * nothing and close real attack classes:
 *
 *  - frame-ancestors 'none' + X-Frame-Options: the admin page cannot be put in
 *    an iframe on someone else's site, which is what clickjacking needs. The
 *    session cookie is SameSite=Lax, so a cross-site POST already can't carry
 *    it; this closes the "trick the producer into clicking Delete" version.
 *  - nosniff: stops a browser deciding an uploaded file is HTML because its
 *    bytes look like HTML. R2 serves what we stored; this makes the browser
 *    believe it.
 *  - Referrer-Policy: a download URL carries the order's token in its query
 *    string. Without this, following any link from that page would leak the
 *    token to the destination in the Referer header. This is not theoretical —
 *    it is the single most likely way a download token escapes.
 *  - Permissions-Policy: nothing here needs a camera, a microphone or a
 *    location, so none of it is allowed to ask.
 *  - HSTS: Cloudflare terminates TLS anyway, but this stops a first-visit
 *    downgrade on a network that rewrites http://.
 *
 * The CSP below deliberately allows inline and eval'd script: Next's App Router
 * ships inline bootstrap scripts, and a nonce-based policy needs middleware
 * generating a per-request nonce. Everything ELSE is locked down — images,
 * media, styles, fonts and connections can only come from this origin, so an
 * injected tag cannot beacon data out or pull a payload from elsewhere. Adding
 * script nonces is the obvious next hardening step, not a substitute for this.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // next/font self-hosts the font files under /_next, so no external font host
  // is needed and none is allowed.
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  // Flutterwave is a full-page redirect, not an XHR, so it needs no connect-src
  // entry. If an embedded checkout is ever used, its origin goes here.
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // Download links carry the order token in the query string. `no-referrer`
        // is stricter than the site default: following ANY link from a download
        // response must not hand that token to a third party.
        source: "/api/download/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // The admin area should never appear in a search index.
        source: "/admin",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
