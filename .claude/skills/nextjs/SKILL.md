---
name: nextjs
description: Next.js App Router and React traps in this repo — the server/client boundary, hydration mismatches, font variables, Suspense, AnimatePresence keys, and stale build types. Load before adding a page or route, moving a component across the client boundary, or debugging anything that "renders fine but is wrong".
---

# Next.js App Router for TISCOPRODZ

Next 16, App Router, deployed to Cloudflare Workers. Every trap below has
already cost time in this repo — they are not hypothetical.

The common shape: **nothing throws.** The build passes, the page renders, and
the result is quietly wrong. That is why each one is written down.

---

## 1. Server by default; `"use client"` goes on the LEAF

Every component is a server component unless it says otherwise. `"use client"`
does not mark one component — it marks that component **and everything it
imports** as browser code.

So push it as far down the tree as possible. `HeroSlider` is a client component
because it animates; the page that renders it is not. Put `"use client"` on the
page instead and the whole page — including the database reads — leaves the
server.

**Read the database in a server component.** On Cloudflare, D1 is a binding on
the same request, so `await listPublicBeats()` in a server component costs less
than the round trip a client `fetch` would need. The catalogue pages do this;
none of them have a loading spinner because there is nothing to wait for.

## 2. Hydration mismatch: anything the server cannot know

The server renders HTML with no access to `localStorage`, `window`, `Date.now()`
in the user's timezone, or `matchMedia`. If the first client render disagrees
with that HTML, React throws a hydration error and may discard the markup.

In this repo it bites wherever a Zustand store is persisted — the cart badge,
the "IN CART" tag, the audio player:

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
const inCart = mounted && has(beat.id);   // false on the server AND first paint
```

The rule: **render the server's answer first, then correct it after mount.**
Not `typeof window !== "undefined"` inline, which produces exactly the
disagreement it is trying to avoid.

## 3. `useSearchParams` needs a Suspense boundary

`next build` fails outright without one. `/cart` reads `?tx_ref=` coming back
from Flutterwave, so the page is a thin wrapper:

```tsx
export default function CartPage() {
  return <Suspense fallback={<Loading />}><CartInner /></Suspense>;
}
```

## 4. CSS variables from `next/font` live on the CLASS, not `:root`

**The bug that shipped unnoticed for days.** `next/font` returns a class that
defines `--font-display-face`, and that class goes on `<body>`. Tailwind's
`@theme` block defines `--font-display: var(--font-display-face), ...` at
`:root` — where the face variable **does not exist yet**. It substitutes to
nothing, the whole `font-family` is dropped, and every heading falls back to the
browser default.

It went unnoticed because the fallback for a serif display face is Times New
Roman — also a serif, so it looked approximately right.

Fix: re-declare inside `@layer base` on `body`, below the class that defines the
face:

```css
body { --font-display: var(--font-display-face), ui-sans-serif, sans-serif; }
```

**How to check:** `getComputedStyle(el).fontFamily` in the console. If it says
`"Times New Roman"`, the variable chain is broken. Never trust the screenshot.

## 5. `.next/` types go stale when a route is deleted

Deleting a route handler leaves its generated type behind, and `tsc` fails with
`Cannot find module '../../src/app/api/<gone>/route.js'`. The source is correct;
the cache is not.

```bash
rm -rf .next && pnpm run typecheck
```

Do this reflexively after removing any route or page.

## 6. A folder starting with `_` is not a route

`src/app/api/_probe/route.ts` 404s. Leading underscore marks a **private
folder** that the router ignores. Useful deliberately, baffling by accident.

## 7. `AnimatePresence` needs a CHANGING key

No key, or a key that stays the same, and the exit animation never runs. The
hero keys on the slide index. Choose the mode deliberately:

- `mode="wait"` — the outgoing element finishes first. Correct for a big
  headline: two of them cross-fading through each other is illegible.
- default (overlap) — both on screen briefly. Correct for a background: a gap
  between two of them is a flash of empty page.

## 8. `/public` cannot be checked at build time

Next has no idea whether a file was dropped into `/public`. A missing one
renders as a broken-image icon. Fall back at runtime instead:

```tsx
const [failed, setFailed] = useState(false);
if (failed) return <Fallback />;
return <img src={src} onError={() => setFailed(true)} />;
```

That is what lets the hero art be "copy three files in, delete them to undo",
with no code change either way.

## 9. Route handlers: `params` is a Promise

```tsx
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

Forgetting the `await` gives `[object Promise]` in a query, which returns no
rows rather than erroring.

## 10. Caching: be explicit

Pages that read the catalogue declare `export const dynamic = "force-dynamic"`.
Without it a publish would not show up until the cache expired. When the
catalogue settles, `export const revalidate = 60` is the cheaper trade — but
make it a decision, not a default.

---

## Before saying a page works

1. `rm -rf .next && pnpm run typecheck`
2. Load it under `pnpm run preview` — the real Worker, not `pnpm dev`
3. Console open: zero hydration warnings
4. `getComputedStyle` on one heading — is the font the one you chose?
5. Resize to 360px wide — does the primary action still fit on screen?
