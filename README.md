# TISCOPRODZ

A beat store for one producer. Next.js on Cloudflare Workers, **D1** for the
database, **R2** for the audio. Buyers pay **in US dollars** by card through
Flutterwave's hosted checkout and get the untagged master immediately.

Built from jst-beat's selling flow, with everything that wasn't selling beats
removed: no second producer, no revenue splitting, no store releases, no blog.

---

## The skills

`.claude/skills/` carries the rules this repo is built on — read the relevant one
before changing that area:

| skill | covers |
|---|---|
| `ui-ux` | hierarchy, contrast, balance, full-bleed media layouts |
| `nextjs` | App Router traps: the client boundary, hydration, fonts, stale types |
| `design` | the red palette, type pairing, spacing, how each surface is styled |
| `motion` | Motion (Framer Motion) v13 — durations, easings, the slide transition |
| `cloudflare` | D1, R2, bindings, the Node APIs that don't exist here, migrations |
| `payments` | the Flutterwave flow, what is never trusted, delivery rules |
| `run` | how to launch it and actually verify a change |

## The map

```
  browser
    │
    │  every page is server-rendered ON Cloudflare
    ▼
  Worker  (.open-next/worker.js — the whole Next.js app)
    │
    ├── D1  (SQLite)   beats · orders · rate_limits · settings
    └── R2  (objects)  covers/ previews/  ← public
                       masters/ stems/    ← private, never served without a paid order
```

**D1 and R2 are bindings, not URLs.** Cloudflare injects live objects into the
Worker for each request, so there is no connection string to leak and no network
hop to another region. `src/lib/cf.ts` is the only file that touches them.

### The money rule

Prices belong to the **licence tier**, not the beat. `src/lib/licenses.ts` holds
all five tiers from the licensing spec — MP3 $19.99, WAV + MP3 $35.99, Unlimited
$65.99, Trackout $120, Exclusive by negotiation — with their distribution and
stream limits and the formats each one delivers.

The catalogue, the beat page, `/licenses` and checkout all read that one object,
so the terms shown can never drift from the terms sold. **USD only**, and every
amount is an **integer of cents** — never a float.

What a beat decides is not its price but **which tiers it can serve**, and it
decides that by which files were uploaded: no WAV means only the MP3 licence, no
stems means no Trackout.

### The delivery rule

Nothing in R2 is reachable from the internet on its own. Public art and preview
clips go out through `/api/media/[...key]`, which only serves the `covers/` and
`previews/` prefixes. A private file leaves only through `/api/download/file`, which requires an order
marked `paid`, the 32-byte `download_token` from that order, that the order
includes this beat and tier, and that the tier includes the format asked for.
The token is released only after Flutterwave confirms the amount and currency.

---

## Set it up

```bash
pnpm install

# 1. the database — paste the printed id into wrangler.jsonc
pnpm run db:create

# 2. the bucket
pnpm run r2:create

# 3. the tables
pnpm run db:migrate:local     # local sqlite, for preview
pnpm run db:migrate           # the real D1

# 4. secrets for local preview
cp .dev.vars.example .dev.vars   # then fill SESSION_SECRET + the Flutterwave keys

# 5. secrets for production
npx wrangler secret put SESSION_SECRET
npx wrangler secret put FLUTTERWAVE_SECRET_KEY
npx wrangler secret put FLUTTERWAVE_SECRET_HASH
```

Then set the admin password **once**:

```bash
curl -X POST http://localhost:8787/api/admin/setup \
  -H 'content-type: application/json' \
  -d '{"password":"a long password"}'
```

That route refuses every call after the first. Sign in at `/admin`.

Finally, in the Flutterwave dashboard set the webhook URL to
`https://<your-domain>/api/flutterwave/webhook` and set the **Secret hash** to the
same value as `FLUTTERWAVE_SECRET_HASH`. Without it, an order only settles while
the buyer's tab is open.

## Run it

| command | what it does |
|---|---|
| `pnpm dev` | Next dev server. **Bindings are emulated**; fast, but not the real runtime. |
| `pnpm run preview` | Builds and runs the actual Worker locally with real D1/R2. Test here before deploying. |
| `pnpm run deploy` | Ships it. |
| `pnpm run db:generate` | Regenerate the migration after editing `src/db/schema.ts`. |
| `pnpm run typecheck` | `tsc --noEmit`. |

## Uploading a beat

`/admin` takes up to five files: cover, **tagged preview**, untagged MP3
(required), untagged WAV (optional), stems ZIP (optional). There are no price
fields — the files decide which tiers the beat can be sold at. Every new beat
saves as a **draft**: look at it on the site, then publish.

The preview must be exported from the DAW **with the voice tag already on it.**
jst-beat generated previews server-side with ffmpeg; a Worker has no filesystem
and cannot run a binary, so that step moved into the export. One extra bounce,
and an entire class of server-side failure disappears.

## Known limits

- **100MB per upload.** The file streams through the Worker into R2, which is far
  better than Vercel's 4.5MB body cap, but it is still a ceiling. A bigger stems
  pack needs R2 multipart upload driven from the browser.
- **Card only.** The charge is in USD, and M-Pesa is a shilling rail that cannot
  settle one. Taking M-Pesa would mean a second, KES-denominated checkout path.
- **No order emails.** A buyer who closes the tab before downloading has to come
  back with their reference. The webhook marks the order paid; nothing mails them
  the links yet.
