import { createHmac } from "node:crypto";
import { producerShareCents, PRODUCER_SHARE, hasSplit, startPayment, verifyPayment, verifyWebhookSignature } from "@/lib/paystack";
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

console.log("\n=== 2. WHAT IS ACTUALLY SENT TO PAYSTACK ===");
let captured: any = null;
let reply: any = { status: true, data: { authorization_url: "https://checkout.paystack.com/x" } };
globalThis.fetch = (async (url: string, init: any) => {
  captured = { url, body: init?.body ? JSON.parse(init.body) : null };
  return { json: async () => reply };
}) as never;

const r = await startPayment({ email: "buyer@example.com", amountUsdCents: 13999, reference: "TSC-1", redirectUrl: "https://x/cart" });
const b = captured.body;
console.log("  " + JSON.stringify({ currency: b.currency, amount: b.amount, channels: b.channels, subaccount: b.subaccount, transaction_charge: b.transaction_charge, bearer: b.bearer, metadata: b.metadata }, null, 2).replace(/\n/g, "\n  "));
ok(captured.url === "https://api.paystack.co/transaction/initialize", "POST /transaction/initialize");
ok(b.currency === "USD", "currency is USD");
ok(JSON.stringify(b.channels) === '["card"]', "card only (no M-Pesa: USD cannot settle on a shilling rail)");
ok(b.amount === 13999, "amount sent in CENTS (13999, not 139.99)");
ok(b.subaccount === "ACCT_client123", "client subaccount attached");
ok(b.transaction_charge === 1400, `main account keeps $14.00 = 10% (got ${b.transaction_charge}c)`);
ok(b.amount - b.transaction_charge === 12599, "client subaccount receives the $125.99 remainder = 90%");
ok(b.bearer === undefined, "bearer left at default 'account': fee comes out of the 10%, not the client's 90%");
ok(b.metadata.producer_share_cents === 12599 && b.metadata.platform_share_cents === 1400, "split stamped in metadata for reconciliation");
ok(r.splitApplied === true && r.checkoutUrl === "https://checkout.paystack.com/x", "returns authorization_url, splitApplied true");

console.log("\n=== 3. NO SUBACCOUNT CONFIGURED ===");
(globalThis as any).__SUBACCOUNT__ = "";
const r2 = await startPayment({ email: "b@e.com", amountUsdCents: 6599, reference: "TSC-2", redirectUrl: "https://x/cart" });
ok(captured.body.subaccount === undefined && captured.body.transaction_charge === undefined, "no split keys sent when unconfigured");
ok(r2.splitApplied === false, "splitApplied false -> order flagged for manual payout");
ok(hasSplit() === false, "hasSplit() false");
ok(r2.producerCents === 5939, "producer share still computed + recorded ($59.39 owed by hand)");
(globalThis as any).__SUBACCOUNT__ = undefined;

reply = { status: false, message: "Invalid key" };
let threw = false;
try { await startPayment({ email: "b@e.com", amountUsdCents: 6599, reference: "TSC-3", redirectUrl: "https://x/cart" }); } catch { threw = true; }
ok(threw, "status:false from Paystack throws (boolean envelope, not the string 'success')");

console.log("\n=== 3b. VERIFY STATUS MAPPING ===");
const cases: [any, string][] = [
  [{ status: true, data: { status: "success", amount: 13999, currency: "USD" } }, "success"],
  [{ status: true, data: { status: "abandoned", amount: 13999, currency: "USD" } }, "pending"],
  [{ status: true, data: { status: "failed", amount: 13999, currency: "USD" } }, "failed"],
  [{ status: false, message: "Transaction reference not found" }, "pending"],
];
for (const [rep, want] of cases) {
  reply = rep;
  const tx = await verifyPayment("TSC-1");
  ok(tx.status === want, `${rep.data?.status ?? "not found"} -> ${want}`);
}
reply = { status: true, data: { status: "success", amount: 13999, currency: "USD" } };
const tx = await verifyPayment("TSC-1");
ok(tx.amountUsdCents === 13999, "amount read as cents, no *100");
ok(captured.url === "https://api.paystack.co/transaction/verify/TSC-1", "GET /transaction/verify/:reference");

console.log("\n=== 4. WEBHOOK AUTH (HMAC-SHA512 of the raw body) ===");
const body = JSON.stringify({ event: "charge.success", data: { reference: "TSC-1" } });
const good = createHmac("sha512", "sk_test_stub").update(body).digest("hex");
ok(await verifyWebhookSignature(body, good) === true, "signature from node:crypto accepted");
ok(await verifyWebhookSignature(body, good.toUpperCase()) === true, "hex case doesn't matter");
ok(await verifyWebhookSignature(body + " ", good) === false, "one byte of body changed -> rejected");
ok(await verifyWebhookSignature(body, createHmac("sha512", "sk_wrong").update(body).digest("hex")) === false, "signed with another key -> rejected");
ok(await verifyWebhookSignature(body, null) === false, "missing header rejected");
ok(await verifyWebhookSignature(body, "abc") === false, "garbage header rejected");
(globalThis as any).__NOKEY__ = true;
ok(await verifyWebhookSignature(body, good) === false, "no secret key configured -> rejected, not thrown");
(globalThis as any).__NOKEY__ = undefined;

console.log("\n=== 5. EVERY LICENCE TIER, SPLIT ===");
for (const id of LICENSE_ORDER) {
  const l = LICENSES[id];
  if (l.priceCents === null) { console.log(`  ${l.name.padEnd(22)} negotiation only — never charged online`); continue; }
  const p = producerShareCents(l.priceCents);
  console.log(`  ${l.name.padEnd(22)} $${(l.priceCents/100).toFixed(2).padStart(7)}  ->  producer $${(p/100).toFixed(2).padStart(7)}   you $${((l.priceCents-p)/100).toFixed(2).padStart(6)}`);
}

console.log(fail === 0 ? "\nALL CHECKS PASSED\n" : `\n${fail} CHECK(S) FAILED\n`);
