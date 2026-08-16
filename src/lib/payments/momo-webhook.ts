import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditDeposit } from "./credit";
import { parseConfig, underpaid } from "./index";
import { isPaid, signIpn, signatureMatches, type MomoIpn } from "./momo";

/**
 * MoMo stops retrying on a 204, and a 204 may not carry a body — attaching one
 * throws, the gateway sees a 500, and it retries a payment already credited.
 */
function done(_reason: string): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * MoMo's IPN.
 *
 * The signature is the whole of the authentication — MoMo posts from addresses
 * that change, so there is nothing else to check. With no secret stored the
 * route refuses rather than accepting anything: this endpoint hands out real
 * balance, and the panel has already been bitten once by a payment callback
 * that skipped its check when it was not configured.
 *
 * MoMo retries until it gets a 204, so a repeat delivery must be harmless —
 * `creditDeposit` is idempotent on the deposit's own status.
 */
export async function handleMomoWebhook(request: Request) {
  const method = await db.paymentMethod.findFirst({ where: { driver: "momo" } });
  if (!method || !method.enabled) {
    return NextResponse.json({ message: "Method disabled" }, { status: 404 });
  }

  const config = parseConfig(method.config);
  const accessKey = config.accessKey?.trim();
  const secretKey = config.secretKey?.trim();
  if (!accessKey || !secretKey) {
    return NextResponse.json({ message: "Not configured" }, { status: 503 });
  }

  let payload: MomoIpn;
  try {
    payload = (await request.json()) as MomoIpn;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  // accessKey is signed but never sent, so it is put back before checking.
  const expected = signIpn({ ...payload, accessKey }, secretKey);
  if (!signatureMatches(expected, String(payload.signature ?? ""))) {
    return NextResponse.json({ message: "Bad signature" }, { status: 401 });
  }

  // A failed payment is a real, signed message too — it just is not money.
  if (!isPaid(payload.resultCode)) {
    return done("Not a successful payment");
  }

  // orderId is the panel's prefixed reference, e.g. NOVA100124 — the prefix is
  // what keeps it unique across panels sharing a merchant account, so the
  // digits are read off the end rather than the whole string being a number.
  const publicId = Number(/(\d{3,})$/.exec(String(payload.orderId ?? ""))?.[1]);
  if (!Number.isInteger(publicId)) {
    return done("Unknown reference");
  }

  const txn = await db.transaction.findFirst({
    where: { publicId, type: "deposit", methodId: method.id },
  });
  if (!txn) return done("Unknown reference");

  // The signature proves MoMo sent it; it does not prove the amount is the one
  // that was asked for, and a customer who paid less has not paid.
  const received = Number(payload.amount ?? 0);
  if (await underpaid(received, txn.paidAmount, txn.currency)) {
    await db.transaction.update({
      where: { id: txn.id },
      data: { note: `Underpaid: received ${received}, expected ${txn.paidAmount}` },
    });
    return done("Amount is lower than the deposit");
  }

  const result = await creditDeposit(txn.id, String(payload.transId ?? ""), { automatic: true });
  return done(result);
}
