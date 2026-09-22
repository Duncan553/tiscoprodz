---
name: payments
description: The Flutterwave checkout, verification and delivery flow — the order of operations, what is never trusted, and the rules that keep a paid order and a delivered file the same event. Load before touching src/lib/flutterwave.ts, any route under /api/checkout, /api/flutterwave, /api/download, or the orders table.
---

# Payments for TISCOPRODZ

**One processor: Flutterwave. One currency: USD.** Hosted card checkout. There
is no Paystack, no M-Pesa rail and no KES charge anywhere in this repo — we never
touch a card number, which keeps the site out of PCI scope entirely.

**There is no second currency.** The KSh estimate, the FX cache, `/api/rate` and
the two KES columns on `orders` were all removed. One currency means nothing to
keep in sync and nothing that can disagree.

`payment_options` is `"card"` only. M-Pesa is a shilling rail and cannot settle a
USD charge; offering it would show a method that fails at the last step.

## The one rule

**THE BROWSER NEVER NAMES A PRICE.**

The cart sends beat ids and licences. `/api/checkout` looks every price up again
from D1 and computes the total itself. A cart in localStorage is a display
convenience, never an instruction about what to charge. Trusting a posted amount
is how a store sells a $40 beat for one cent.

## Order of operations, and why it cannot be rearranged

```
1. rate limit          before any work
2. re-price from D1    the authority
3. INSERT the order    status "pending", with a fresh download token
4. call Flutterwave    last, because it is the irreversible step
```

**3 before 4 is the important one.** If the insert fails after the charge,
someone has paid for files the download route can never find.

## Prices live on the TIER, not the beat

`src/lib/licenses.ts` is the single source of truth, transcribed from the
licensing spec. There is **no price column on `beats`** — the spec sets one price
per tier for the whole catalogue, so a beat cannot be saved at a price that
contradicts the published terms.

| Tier | Price | Distribution | Streams | Delivers |
|---|---|---|---|---|
| MP3 | $19.99 | 5,000 copies | 50,000 | MP3 |
| WAV + MP3 | $35.99 | 7,500 copies | 100,000 | WAV + MP3 |
| Unlimited | $65.99 | Unlimited | Unlimited | WAV + MP3 |
| Trackout | $120.00 | Unlimited | Unlimited | Stems + WAV + MP3 |
| Exclusive | Negotiation | Unlimited | Unlimited | Stems + WAV + MP3 |

The catalogue, the beat page, `/licenses` and checkout all read this one object,
so the terms **shown** can never drift from the terms **sold**.

**Exclusive is not purchasable.** `priceCents: null` marks it, `isPurchasable()`
enforces it, and the UI renders an enquiry instead of an Add button.

**A tier is only offered if the beat has its files.** `isAvailableFor()` checks
the FILE, not the price — selling a Trackout on a beat with no stems would take
the money and deliver nothing. Enforced in the cart, again at checkout, and
again at download.

## The promotion

Buy one, get one free — toggled at `/admin`, stored in `settings`, applied by
`applyPromo` in `src/lib/promo.ts`.

**PAIRING IS PER-TIER AND NEVER ACROSS TIERS.** Two MP3 licences pair; an MP3
and a WAV do not. Within a tier, every second licence is free.

The first version pooled every line and freed the cheaper of each pair. That let
someone add a $120 Trackout and a $19.99 MP3 and be given the MP3 — buying one
product and receiving a different, cheaper one. It also broke the price ladder:
the cheap tiers became a freebie attached to the expensive ones, so nobody would
buy an MP3 licence on its own again.

`applyPromo` therefore takes `{ license, usdCents }`, not bare prices. If you
ever find yourself computing the discount from prices alone, the tier rule has
been lost.

**The cart and checkout call the same function.** The browser sends only ids and
tiers; the server re-prices from the licence table and re-reads the promotion
from the database, so a tampered cart changes nothing about what is charged.

## Verification

Two paths reach the same conclusion, and both re-check the amount:

- **`/api/checkout/verify`** — polled by the cart while the buyer is on
  Flutterwave, and once on return. Asks Flutterwave directly; never trusts the
  browser's redirect.
- **`/api/flutterwave/webhook`** — the safety net, because people close tabs.
  Fires whether or not the buyer's tab is open.

**Always check the amount AND the currency.** Anything but USD is `flagged`,
because a "successful" charge in another currency is not the charge we asked for.
A signed webhook proves Flutterwave sent it, not that the figure is right.
`flagged` means paid-but-frozen: no files move until a human looks.

**The webhook signature is a plain `verif-hash` header** compared against
`FLUTTERWAVE_SECRET_HASH` — not an HMAC of the body. Compare it in constant time
anyway, and reject on absence.

**Webhooks retry.** Anything already `paid` or `flagged` returns 200 and changes
nothing. Return 200 for events you don't handle, or Flutterwave retries forever.

## Delivery

An order unlocks files only when it is `paid` **and** the caller presents the
32-byte `download_token` stored on that row. The token is released by
verification, never before, and never persisted in the browser.

Gating on the reference alone is not enough — a reference is a timestamp plus a
small random and is guessable.

`/api/download/file` makes **two** checks, and the second is the one people
forget:

1. is this order paid, and is the token right?
2. **does this order actually include this beat AND this licence?**

Without (2), any paid order — a $5 WAV — becomes a key to the whole catalogue,
stems included, by editing the query string.

Answer "no such order", "not paid" and "wrong token" with the **same** 403.
Telling them apart confirms which references exist.

## Testing without live keys

With a dummy secret the Flutterwave call fails and checkout returns its error —
but the order row is still written as `pending`, which is the behaviour to
assert. To exercise delivery, flip a row to `paid` with
`wrangler d1 execute ... --local` and drive `/api/download` with its token.
