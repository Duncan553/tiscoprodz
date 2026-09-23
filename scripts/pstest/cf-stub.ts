export function env() {
  return {
    PAYSTACK_SECRET_KEY: "sk_test_stub",
    // Set by the test to simulate "no payout account configured yet".
    PAYSTACK_PRODUCER_SUBACCOUNT:
      (globalThis as Record<string, unknown>).__SUBACCOUNT__ ?? "ACCT_client123",
  } as never;
}
