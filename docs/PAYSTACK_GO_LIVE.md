# Paystack go-live — TISCOPRODZ

How money moves, what is done, and the exact steps left to take real dollars.

## The big picture

```
Buyer's card (USD)
      │
      ▼
Paystack checkout ──► split on every sale
      │                    │
      ▼                    ▼
 Main account 10%     Client subaccount 90%
 (you, Ecobank USD)   (Tisco Prodz, Equity USD)
 Paystack fee comes   gets a clean 90% of the
 out of this 10%      sticker price
```

- Business: **TISCOPRODZ**, Paystack id **2023696** (same login as JST.BEAT and MOTION APP, but kept separate).
- Card only, **US dollars only**, no M-Pesa.
- Fees (Kenya): 3.8% per international/USD card sale, taken from your 10%. You keep about 6.2% of each sale.
- Payouts land **2 working days** after the sale (T+2).
- Starter Business limit: **KES 600,000 in total** until you upload registration documents (upgrade to Registered Business).

## Already done (2026-09-23)

| Part | State |
|---|---|
| Site code switched to Paystack, deployed | ✅ live on tiscoprodz.tisco.workers.dev |
| Test secret key in Cloudflare + `.dev.vars` | ✅ |
| Test webhook URL saved in dashboard | ✅ `https://tiscoprodz.tisco.workers.dev/api/paystack/webhook` |
| Webhook security checked live | ✅ right signature → 200, wrong → 401 |
| Compliance step 1: Profile | ✅ Starter, Digital goods → books/movies/audio, KES 500k/yr |
| USD charges | ❌ `Currency not supported by merchant` until USD is enabled |

**The site cannot take payments yet.** Checkout shows "Could not start the payment" until step 3 below is done. Don't send buyers yet.

## What's left, in order

Each step unlocks the next. None can be skipped.

### 0. Open the USD bank accounts (blocker)

- **You:** Ecobank **USD** account (called a "domiciliary" or "USD current" account) in your own name.
- **Client:** Equity **USD** account in their own name.
- The account name must match the ID exactly. Paystack checks it.

### 1. Finish activation (Compliance, 4 steps left)

Dashboard → **Compliance**.

| Step | What goes in | Who types it |
|---|---|---|
| Contact | business email, phone, office address (county, city, street), website `https://tiscoprodz.tisco.workers.dev` | Claude can fill it; you give the details |
| Owner | full name as on ID, date of birth, nationality, **National ID number + photo** | ID number and upload: **you** |
| Account | Ecobank + **account number** (likely your KES account here; USD is added in step 2) | account number: **you** |
| Service agreement | read, then accept | **you** accept |

Submit and wait for approval. Tip: message Support (bottom-right chat) at the same time:
> New Kenya business TISCOPRODZ (2023696): we need USD enabled, settling to an Ecobank USD account, and USD subaccounts for split payments.

### 2. Enable USD

Dashboard → **Settings → Accounts → "Add USD account"** (only shows after approval).
Enter the Ecobank USD account number, branch code and account name → Save.
Paystack reviews it in **about 24 hours**, then USD is on.

**Check:** ask Claude to re-run the USD probe. It should say `Authorization URL created` instead of `unsupported_currency`.

### 3. Create the client's subaccount

Dashboard → **Subaccounts → New Subaccount**:

| Field | Value |
|---|---|
| Currency | **USD** (only appears after step 2; if you only see KES, stop, because step 2 isn't done) |
| Type | Bank |
| Bank | Equity Bank Kenya Ltd |
| Account number | client's Equity **USD** account |
| Name | Tisco Prodz (partner 90%) |
| Your share (%) | **10** → subaccount gets **90** |

Copy the code it shows (`ACCT_…`). It's not a secret, so give it to Claude, who runs:
```
npx wrangler secret put PAYSTACK_PRODUCER_SUBACCOUNT
```
Until this is set, sales still work but the whole amount lands in your account, and
**/admin → Earnings** lists what you owe the client by hand.

### 4. Test purchase (still test mode)

Buy the cheapest licence ($19.99) on the site with Paystack's test card:
`4084 0840 8408 4081`, any future expiry, CVV `408`.
Expect: back on /cart, download links appear, order shows **paid** in /admin.

### 5. Go live

1. Dashboard: flip **Test → Live** (top right).
2. Settings → API Keys & Webhooks (Live): set **Live Webhook URL** to
   `https://tiscoprodz.tisco.workers.dev/api/paystack/webhook` → Save.
3. Recreate the subaccount **in Live mode** (test subaccounts don't carry over) → new `ACCT_…`.
4. In your own terminal (**never paste `sk_live_` in chat**):
   ```
   cd ~/tiscoprodz
   npx wrangler secret put PAYSTACK_SECRET_KEY            # paste sk_live_…
   npx wrangler secret put PAYSTACK_PRODUCER_SUBACCOUNT   # paste live ACCT_…
   ```
5. **Real-money proof:** buy the $19.99 licence with your own card. Two working days later
   check both bank statements: you ≈ $2.00 minus the fee, client $17.99.

## If you buy the tiscoprodz.com domain later

Order matters:
1. Change `SITE_URL` in `wrangler.jsonc` → **deploy first**.
2. Then attach the domain in Cloudflare.
3. Update the webhook URL in Paystack (test + live) to the new domain.

Doing it the other way round sends paying buyers back to the old address.

## Where things live in the code

| File | Job |
|---|---|
| `src/lib/paystack.ts` | start payment, verify, split math, webhook signature |
| `src/app/api/checkout/route.ts` | prices from the server, creates the order, then calls Paystack |
| `src/app/api/checkout/verify/route.ts` | cart asks "did the money land?" |
| `src/app/api/paystack/webhook/route.ts` | Paystack tells us, even if the buyer closed the tab |
| `scripts/pstest/` | `pnpm run test:split`, which proves the 10/90 request without a Paystack account |
