export function env() {
  return {
    FLUTTERWAVE_SECRET_KEY: "FLWSECK_TEST-stub",
    // Set by the test to simulate "no payout account configured yet".
    FLUTTERWAVE_PRODUCER_SUBACCOUNT:
      (globalThis as Record<string, unknown>).__SUBACCOUNT__ ?? "RS_PRODUCER_123",
    FLUTTERWAVE_SECRET_HASH: "shared-secret-hash-value",
  } as never;
}
