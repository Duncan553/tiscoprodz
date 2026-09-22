---
name: cloudflare
description: How this app runs on Cloudflare Workers — D1, R2, bindings, the Node APIs that do not exist here, migrations, and the traps that pass locally and fail in production. Load before touching anything in src/lib/cf.ts, src/db/, any API route, wrangler.jsonc, or before adding a dependency.
---

# Cloudflare for TISCOPRODZ

The whole site is ONE Worker. `next build` produces a Node server;
`@opennextjs/cloudflare` repackages it into `.open-next/worker.js`. Static assets
are served by Cloudflare's asset host, so the Worker never pays for them.

```
Worker (.open-next/worker.js)
  ├── D1  binding "DB"   SQLite: beats · orders · rate_limits · settings
  └── R2  binding "R2"   objects: covers/ previews/ (public) · masters/ stems/ (private)
```

**Bindings are live objects, not URLs.** There is no connection string, so there
is nothing to leak and no hop to another region. `src/lib/cf.ts` is the ONLY file
that calls `getCloudflareContext()`. Everything else imports `db()`, `bucket()`,
`env()` from there.

**Call them inside a handler, never at module scope.** The sync form of
`getCloudflareContext()` throws when there is no request in flight, and a module
body runs at build time.

## What does not exist here

This is not Node. These fail — sometimes only in production:

| Don't | Why | Use |
|---|---|---|
| `crypto.createHmac` / `node:crypto` | not in the Workers runtime | Web Crypto: `crypto.subtle` |
| `bcrypt`, `argon2` | native bindings | PBKDF2 via `crypto.subtle` (see `src/lib/auth.ts`) |
| `fs`, file paths, `os.tmpdir()` | no filesystem | R2, or do it before upload |
| `ffmpeg`, any spawned binary | no processes | **the producer exports the tagged preview from the DAW** |
| `axios` | pulls Node http internals | `fetch` |
| a module-level `let` as a cache | each isolate has its own, and they die constantly | D1 (`settings` table) — see `src/lib/pricing.ts` |
| a module-level `Map` rate limiter | same: enforces nothing across isolates | the `rate_limits` table — see `src/lib/rate-limit.ts` |

The last two are the dangerous ones: they work perfectly on one long-lived Node
server, pass every local test, and silently enforce nothing in production.

### Web Crypto has limits the local runtime does not enforce

**PBKDF2 is capped at 100,000 iterations.** Ask for more and Workers throws:

```
NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
supported (requested 150000).
```

This repo shipped `150_000`. Every local test passed — the local runtime
accepts it — and the DEPLOYED site could not hash a password at all. Admin
login and first-run setup both returned 500, and the real reason appeared
nowhere except `wrangler tail`.

The general lesson, and it is the reason `pnpm run preview` exists in this repo:
**a local pass proves nothing about the platform's own limits.** When a crypto,
size or time limit is involved, exercise it against the real runtime before
believing it.

### How to find an error that only happens in production

`wrangler tail` streams live logs from the deployed Worker. A 500 with no useful
body is almost always a thrown error whose message is sitting in there:

```bash
npx wrangler tail tiscoprodz --format json
# then make the failing request; look for "logs" and "exceptions"
```

`nodejs_compat` in `wrangler.jsonc` covers the node: imports Next itself needs.
It does not conjure a filesystem.

## Money in SQLite

D1 is SQLite: no boolean, no timestamp, no JSON column. Booleans are `0`/`1`,
times are unix seconds, JSON is `text`.

**Every amount is an INTEGER of minor units (cents).** Never a float, never
`REAL`. `0.1 + 0.2 !== 0.3`, and a catalogue losing a cent per sale is invisible
until the settlement statement.

## Migrations

Drizzle **generates** the SQL; **wrangler applies** it. They are separate steps
and forgetting the second is why a column "doesn't exist" in production.

```bash
# 1. edit src/db/schema.ts
pnpm run db:generate        # writes drizzle/NNNN_*.sql
pnpm run db:migrate:local   # local SQLite, for preview
pnpm run db:migrate         # the real D1  <-- easy to forget
```

Never hand-edit a generated file in `drizzle/` — the journal in `drizzle/meta`
tracks it and the two will disagree.

## Running it

| command | runtime | use it for |
|---|---|---|
| `pnpm dev` | Node, bindings **emulated** | fast iteration on UI |
| `pnpm run preview` | the **real** workerd + real D1/R2 | anything touching DB, R2, crypto, secrets |
| `pnpm run deploy` | production | shipping |

**A feature is not verified until it has run under `pnpm run preview`.** That is
where a Node-only API finally throws.

## Secrets

Non-secret config goes in `wrangler.jsonc` `vars` — that file is committed.
Secrets go in `.dev.vars` locally (gitignored) and `wrangler secret put NAME` in
production. `.dev.vars` is read by the **Worker**, so `pnpm dev` will not see it;
`pnpm run preview` will. That difference is the usual cause of "works in dev,
500s in preview".

## Limits worth knowing

- **~100MB request body.** Fine for a WAV, a ceiling for a big stems pack. A
  larger file needs R2 multipart driven from the browser.
- **Nothing in R2 is public.** The bucket has no public URL; bytes leave only
  through `/api/media` (public prefixes, cached immutable) or
  `/api/download/file` (paid order + token). Never add a prefix to
  `isPublicKey()` without meaning it.
- **CPU time is metered.** Stream R2 objects through (`new Response(object.body)`)
  — never buffer a file into memory to re-emit it.
