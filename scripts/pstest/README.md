# Paystack split test

Proves the 90/10 revenue split without a Paystack account, by running the
real `src/lib/paystack.ts` with `env()` stubbed and `fetch` intercepted — so
what it prints is the request body that would actually go to Paystack, not a
description of it.

    pnpm run test:split

Checks: the split math across many amounts (including the rounding edge), the
exact `subaccount` + `transaction_charge` payload, USD + card only, the
no-subaccount fallback, verify-status mapping, and webhook HMAC-SHA512 auth
against a signature computed independently with node:crypto.
