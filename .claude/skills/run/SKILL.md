---
name: run
description: How to launch TISCOPRODZ locally and confirm a change actually works. Use when asked to run, start, preview, or screenshot the app, or to verify a change in the real app rather than only in tests.
---

# Running TISCOPRODZ

```bash
pnpm install
pnpm run preview     # builds and runs the REAL Worker on http://localhost:8787
```

**Use `pnpm run preview`, not `pnpm dev`, for anything that touches the database,
R2, crypto or secrets.** `pnpm dev` is Node with emulated bindings — faster for
UI work, but it will happily run code that throws on the real runtime. See
`.claude/skills/cloudflare/SKILL.md`.

## First run on a clean machine

```bash
pnpm run db:create              # paste the printed id into wrangler.jsonc
pnpm run r2:create
pnpm run db:migrate:local
cp .dev.vars.example .dev.vars  # fill SESSION_SECRET + FLUTTERWAVE_SECRET_KEY
```

Then set the admin password once (the route refuses every call after the first):

```bash
curl -X POST http://localhost:8787/api/admin/setup \
  -H 'content-type: application/json' -d '{"password":"a long password"}'
```

## Seeing real content

The catalogue is empty until a beat exists, and a new beat is a **draft** —
it does not appear on the site until published. Sign in at `/admin`, upload
cover + tagged preview + master, then hit Publish.

For a quick check without real audio, any file of the right MIME type works:

```bash
head -c 20000 /dev/urandom > /tmp/cover.png   # send as type=image/png
```

## The trap: wrangler does not rebuild

`wrangler dev` serves `.open-next/worker.js` as it was when the Worker started.
Editing `src/` does **not** regenerate that bundle, so the old code keeps
answering and you debug a version that no longer exists on disk. After any
source change:

```bash
npx opennextjs-cloudflare build     # regenerate the bundle
# then restart wrangler dev
```

`pnpm run preview` does both in one command — prefer it, and only run the two
steps by hand when you want to keep a server up between edits.

Symptom to recognise: a route returning an error that matches code you already
deleted, or an env var that `wrangler dev` clearly lists under "Bindings" but
the app claims is missing.

## Inspecting state

```bash
npx wrangler d1 execute tiscoprodz --local --command "select id,title,published from beats"
npx wrangler d1 execute tiscoprodz --local --command "select reference,status,amount_kes_cents from orders"
```

## Before saying it works

- `pnpm run typecheck`
- exercise the path under `pnpm run preview`, not just `pnpm dev`
- for a payment change, confirm the **order row exists as `pending`** even when
  the processor call fails
