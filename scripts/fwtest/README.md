# Flutterwave split test

Proves the 90/10 revenue split without a Flutterwave account, by running the
real `src/lib/flutterwave.ts` with `env()` stubbed and `fetch` intercepted — so
what it prints is the request body that would actually go to Flutterwave, not a
description of it.

    pnpm run test:split

Checks: the split math across many amounts (including the rounding edge), the
exact `subaccounts` payload, USD + card only, the no-subaccount fallback that is
today's live state, and webhook hash auth.
