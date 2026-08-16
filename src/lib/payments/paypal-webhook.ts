import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditDeposit, failDeposit } from "./credit";
import { parseConfig } from "./index";
import { captureOrder, verifyWebhook } from "./paypal";

/**
 * PayPal callback.
 *
 * The return page captures as soon as the payer comes back, and this exists
 * for when they do not — they close the tab, the browser drops the redirect,
 * the phone loses signal. PayPal keeps telling us about the order either way.
 *
 * Both paths end at `creditDeposit`, which is idempotent inside its own
 * transaction, so the two racing is the expected case rather than a hazard.
 */

type Resource = {
  id?: string;
  custom_id?: string;
  invoice_id?: string;
  status?: string;
  amount?: { value?: string; currency_code?: string };
  supplementary_data?: { related_ids?: { order_id?: string } };
};

export async function handlePaypalWebhook(request: Request) {
  const method = await db.paymentMethod.findFirst({ where: { driver: "paypal" } });
  if (!method || !method.enabled) {
    return NextResponse.json({ received: false, message: "Method disabled" }, { status: 404 });
  }

  const config = parseConfig(method.config);
  const raw = await request.text();

  // Fails closed: without the webhook id nothing can be proven, and a body
  // nobody can prove is a body anybody could have sent.
  if (!(await verifyWebhook(config, request.headers, raw))) {
    return NextResponse.json({ received: false, message: "Unverified" }, { status: 401 });
  }

  let event: { event_type?: string; resource?: Resource };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ received: false, message: "Invalid JSON" }, { status: 400 });
  }

  const type = String(event.event_type ?? "");
  const resource = event.resource ?? {};

  // `custom_id` is the transaction id the driver set on the purchase unit; on
  // a capture event it rides along on the capture itself.
  const transactionId = String(resource.custom_id ?? "").trim();
  if (!transactionId) return NextResponse.json({ received: true, message: "No reference" });

  const txn = await db.transaction.findFirst({
    where: { id: transactionId, type: "deposit", methodId: method.id },
  });
  // 200 rather than an error: PayPal retries for days, and an event for
  // another panel is not this panel's failure.
  if (!txn) return NextResponse.json({ received: true, message: "Unknown reference" });

  if (type === "PAYMENT.CAPTURE.DENIED" || type === "CHECKOUT.ORDER.VOIDED") {
    await failDeposit(txn.id, `PayPal ${type.split(".").pop()?.toLowerCase()}`);
    return NextResponse.json({ received: true, message: "failed" });
  }

  // The payer approved but nobody has taken the money yet — which is exactly
  // the state every PayPal deposit used to end in.
  if (type === "CHECKOUT.ORDER.APPROVED") {
    const orderId = String(resource.id ?? "");
    if (!orderId) return NextResponse.json({ received: true, message: "No order id" });
    const captured = await captureOrder(config, orderId);
    if (!captured.ok && !captured.alreadyCaptured) {
      return NextResponse.json({ received: true, message: captured.reason });
    }
    if (captured.ok && !matches(captured.amount, captured.currency, txn)) {
      return await mismatch(txn.id, captured.amount, captured.currency, txn);
    }
    const result = await creditDeposit(txn.id, captured.ok ? captured.captureId : orderId, { automatic: true });
    return NextResponse.json({ received: true, message: result });
  }

  if (type !== "PAYMENT.CAPTURE.COMPLETED") {
    return NextResponse.json({ received: true, message: `ignored ${type || "unknown"}` });
  }

  const paid = Number(resource.amount?.value ?? 0);
  const currency = String(resource.amount?.currency_code ?? "");
  if (!matches(paid, currency, txn)) return await mismatch(txn.id, paid, currency, txn);

  const result = await creditDeposit(txn.id, String(resource.id ?? ""), { automatic: true });
  return NextResponse.json({ received: true, message: result });
}

/** What PayPal says it took, against what the panel asked for. */
function matches(paid: number, currency: string, txn: { paidAmount: number; currency: string }): boolean {
  if (currency.toUpperCase() !== txn.currency.toUpperCase()) return false;
  // A hundredth of a unit of slack for the float, not a unit of slack for the
  // payer — see the note on the bank webhooks.
  return paid + 0.005 >= txn.paidAmount;
}

async function mismatch(id: string, paid: number, currency: string, txn: { paidAmount: number; currency: string }) {
  await db.transaction.update({
    where: { id },
    data: { note: `Underpaid: received ${paid} ${currency || "?"}, expected ${txn.paidAmount} ${txn.currency}` },
  });
  return NextResponse.json({ received: true, message: "Amount does not match" });
}
