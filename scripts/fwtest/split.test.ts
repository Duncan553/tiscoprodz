import { producerShareCents, PRODUCER_SHARE, hasSplit, startPayment, verifyWebhookHash } from "@/lib/flutterwave";
import { LICENSES, LICENSE_ORDER } from "@/lib/licenses";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log("  FAIL " + m); } else console.log("  ok   " + m); };

console.log("\n=== 1. SPLIT MATH: producer 90%, platform 10%, nothing lost ===");
const amounts = [1999, 3599, 6599, 12000, 100, 999, 13999, 1, 33333, 250000];
for (const total of amounts) {
  const prod = producerShareCents(total);
  const plat = total - prod;
  const exact = prod + plat === total;
  const pct = (prod / total) * 100;
  const within = total < 100 ? true : Math.abs(pct - 90) < 1.0;
  console.log(`  $${(total/100).toFixed(2).padStart(9)}  producer $${(prod/100).toFixed(2).padStart(8)} (${pct.toFixed(2)}%)  you $${(plat/100).toFixed(2).padStart(7)}  sums=${exact}`);
  if (!exact) { fail++; console.log("   FAIL cents lost"); }
  if (!within) { fail++; console.log("   FAIL not ~90%"); }
}
ok(PRODUCER_SHARE === 0.9, "PRODUCER_SHARE is 0.9");
ok(producerShareCents(999) === 899, "rounds DOWN (999c -> 899c, odd cent stays with you)");

console.log("\n=== 2. WHAT IS ACTUALLY SENT TO FLUTTERWAVE ===");
let captured: any = null;
globalThis.fetch = (async (url: string, init: any) => {
  captured = { url, body: JSON.parse(init.body) };
  return { json: async () => ({ status: "success", data: { link: "https://checkout.flutterwave.com/x" } }) };
}) as never;

const r = await startPayment({ email: "buyer@example.com", amountUsdCents: 13999, reference: "TSC-1", redirectUrl: "https://x/cart" });
const b = captured.body;
console.log("  " + JSON.stringify({ currency: b.currency, amount: b.amount, payment_options: b.payment_options, subaccounts: b.subaccounts, meta: b.meta }, null, 2).replace(/\n/g, "\n  "));
ok(b.currency === "USD", "currency is USD");
ok(b.payment_options === "card", "card only (no M-Pesa: USD cannot settle on a shilling rail)");
ok(b.amount === 139.99, "amount sent in MAJOR units (139.99, not 13999)");
ok(Array.isArray(b.subaccounts) && b.subaccounts.length === 1, "one subaccount entry");
ok(b.subaccounts[0].transaction_charge_type === "flat_subaccount", "flat_subaccount, not a ratio");
ok(b.subaccounts[0].transaction_charge === 125.99, `producer subaccount gets $125.99 (got $${b.subaccounts[0].transaction_charge})`);
ok(Math.round((13999 - b.subaccounts[0].transaction_charge * 100)) === 1400, "you keep $14.00 = 10%");
ok(b.meta.producer_share_cents === 12599 && b.meta.platform_share_cents === 1400, "split stamped in meta for reconciliation");
ok(r.splitApplied === true, "splitApplied reported true");

console.log("\n=== 3. NO SUBACCOUNT CONFIGURED (today's state) ===");
(globalThis as any).__SUBACCOUNT__ = "";
const r2 = await startPayment({ email: "b@e.com", amountUsdCents: 6599, reference: "TSC-2", redirectUrl: "https://x/cart" });
ok(captured.body.subaccounts === undefined, "no subaccounts key sent when unconfigured");
ok(r2.splitApplied === false, "splitApplied false -> order flagged for manual payout");
ok(hasSplit() === false, "hasSplit() false");
ok(r2.producerCents === 5939, "producer share still computed + recorded ($59.39 owed by hand)");

console.log("\n=== 4. WEBHOOK AUTH ===");
(globalThis as any).__SUBACCOUNT__ = undefined;
ok(verifyWebhookHash("shared-secret-hash-value") === true, "correct hash accepted");
ok(verifyWebhookHash("wrong-secret-hash-value!") === false, "wrong hash rejected");
ok(verifyWebhookHash(null) === false, "missing header rejected");
ok(verifyWebhookHash("") === false, "empty header rejected");

console.log("\n=== 5. EVERY LICENCE TIER, SPLIT ===");
for (const id of LICENSE_ORDER) {
  const l = LICENSES[id];
  if (l.priceCents === null) { console.log(`  ${l.name.padEnd(22)} negotiation only — never charged online`); continue; }
  const p = producerShareCents(l.priceCents);
  console.log(`  ${l.name.padEnd(22)} $${(l.priceCents/100).toFixed(2).padStart(7)}  ->  producer $${(p/100).toFixed(2).padStart(7)}   you $${((l.priceCents-p)/100).toFixed(2).padStart(6)}`);
}

console.log(fail === 0 ? "\nALL CHECKS PASSED\n" : `\n${fail} CHECK(S) FAILED\n`);
