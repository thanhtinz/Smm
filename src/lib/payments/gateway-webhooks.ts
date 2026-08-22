import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditDeposit, failDeposit } from "./credit";
import { parseConfig } from "./index";
import {
  cryptomusWebhookValid,
  binancePaySign,
  payeerCallbackFields,
  payeerSign,
  perfectMoneyHash,
  signaturesMatch,
} from "./gateway-signing";

/**
 * The callbacks the four newer gateways send.
 *
 * Each follows the same three steps as the ones already here, in the same
 * order and for the same reasons: find the method and check it is switched on,
 * verify the signature over the bytes that actually arrived, and only then
 * look at what the body claims. The body is written by whoever can reach the
 * URL until the signature says otherwise, so nothing before that step may
 * touch the ledger.
 */

/** The deposit a reference points at, or nothing. */
async function depositFor(methodId: string, reference: string, prefix: string) {
  const clean = (prefix || "NOVA").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "NOVA";
  const match = reference.trim().toUpperCase().match(new RegExp(`^${clean}(\\d{3,})$`));
  if (!match) return null;
  return db.transaction.findFirst({
    where: { publicId: Number(match[1]), type: "deposit", methodId },
  });
}

/** The enabled method for one driver, with its config already parsed. */
async function methodFor(driver: string) {
  const method = await db.paymentMethod.findFirst({ where: { driver } });
  if (!method || !method.enabled) return null;
  return { method, config: parseConfig(method.config) };
}

const disabled = () => NextResponse.json({ success: false, message: "Method disabled" }, { status: 404 });
const unconfigured = () => NextResponse.json({ success: false, message: "Not configured" }, { status: 503 });
const badSignature = () => NextResponse.json({ success: false, message: "Bad signature" }, { status: 401 });
const unknownReference = () => NextResponse.json({ success: false, message: "Unknown reference" }, { status: 202 });

// ------------------------------------------------------------------ Cryptomus

const CRYPTOMUS_PAID = new Set(["paid", "paid_over"]);
const CRYPTOMUS_DEAD = new Set(["cancel", "fail", "system_fail", "wrong_amount", "refund_process"]);

export async function handleCryptomusWebhook(request: Request) {
  const found = await methodFor("cryptomus");
  if (!found) return disabled();
  const { method, config } = found;
  if (!config.apiKey) return unconfigured();

  // Read once as text: the signature covers these exact bytes.
  const raw = await request.text();
  if (!cryptomusWebhookValid(raw, config.apiKey)) return badSignature();

  const body = JSON.parse(raw) as Record<string, unknown>;
  const status = String(body.status ?? "").toLowerCase();
  const txn = await depositFor(method.id, String(body.order_id ?? ""), config.prefix);
  if (!txn) return unknownReference();

  if (CRYPTOMUS_DEAD.has(status)) {
    await failDeposit(txn.id, `Cryptomus payment ${status}`);
    return NextResponse.json({ success: true, message: status });
  }
  if (!CRYPTOMUS_PAID.has(status)) {
    return NextResponse.json({ success: true, message: `ignored ${status || "unknown"}` });
  }

  // Underpaid invoices are recorded rather than credited, so a human settles
  // them. "paid_over" is the opposite problem and is not one.
  if (status === "paid" && body.payment_amount != null && body.merchant_amount != null) {
    const paid = Number(body.payment_amount);
    const owed = Number(body.merchant_amount);
    if (owed > 0 && paid > 0 && paid + 1e-8 < owed) {
      await db.transaction.update({
        where: { id: txn.id },
        data: { note: `Underpaid: received ${paid}, expected ${owed}` },
      });
      return NextResponse.json({ success: false, message: "Amount is lower than the invoice" }, { status: 202 });
    }
  }

  return NextResponse.json({
    success: true,
    message: await creditDeposit(txn.id, String(body.uuid ?? ""), { automatic: true }),
  });
}

// ----------------------------------------------------------------- Binance Pay

/**
 * Binance Pay signs its callback the same way it expects a request to be
 * signed, over the timestamp and nonce it sends in the headers.
 */
export async function handleBinancePayWebhook(request: Request) {
  const found = await methodFor("binancepay");
  if (!found) return disabled();
  const { method, config } = found;
  if (!config.apiSecret) return unconfigured();

  const raw = await request.text();
  const timestamp = request.headers.get("binancepay-timestamp") ?? "";
  const nonce = request.headers.get("binancepay-nonce") ?? "";
  const provided = request.headers.get("binancepay-signature") ?? "";
  if (!timestamp || !nonce || !provided) return badSignature();
  if (!signaturesMatch(binancePaySign({ timestamp, nonce, body: raw, secret: config.apiSecret }), provided)) {
    return badSignature();
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  // The interesting fields are inside `data`, which arrives as a JSON string.
  let data: Record<string, unknown> = {};
  try {
    data = typeof body.data === "string" ? (JSON.parse(body.data) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  const reference = String(data.merchantTradeNo ?? "");
  const txn = await depositFor(method.id, reference, config.prefix);
  if (!txn) return unknownReference();

  const event = String(body.bizStatus ?? "").toUpperCase();
  if (event === "PAY_CLOSED") {
    await failDeposit(txn.id, "Binance Pay order closed");
    return NextResponse.json({ returnCode: "SUCCESS" });
  }
  if (event !== "PAY_SUCCESS") {
    return NextResponse.json({ returnCode: "SUCCESS", returnMessage: `ignored ${event || "unknown"}` });
  }

  await creditDeposit(txn.id, String(data.transactionId ?? ""), { automatic: true });
  // Binance stops retrying only on this exact body.
  return NextResponse.json({ returnCode: "SUCCESS", returnMessage: null });
}

// --------------------------------------------------------------------- Payeer

export async function handlePayeerWebhook(request: Request) {
  const found = await methodFor("payeer");
  if (!found) return disabled();
  const { method, config } = found;
  if (!config.secretKey) return unconfigured();

  const form = await request.formData();
  const body: Record<string, string> = {};
  for (const [k, v] of form.entries()) body[k] = String(v);

  if (!signaturesMatch(payeerSign(payeerCallbackFields(body), config.secretKey), body.m_sign ?? "")) {
    return badSignature();
  }

  const txn = await depositFor(method.id, body.m_orderid ?? "", config.prefix);
  // Payeer keeps retrying until it reads the reference back, so an unknown one
  // still answers in its own language rather than with JSON.
  if (!txn) return new NextResponse(`${body.m_orderid ?? ""}|error`, { status: 200 });

  const status = (body.m_status ?? "").toLowerCase();
  if (status !== "success") {
    await failDeposit(txn.id, `Payeer payment ${status || "unknown"}`);
    return new NextResponse(`${body.m_orderid}|error`, { status: 200 });
  }

  await creditDeposit(txn.id, body.m_operation_id ?? "", { automatic: true });
  return new NextResponse(`${body.m_orderid}|success`, { status: 200 });
}

// -------------------------------------------------------------- Perfect Money

export async function handlePerfectMoneyWebhook(request: Request) {
  const found = await methodFor("perfectmoney");
  if (!found) return disabled();
  const { method, config } = found;
  if (!config.passphrase) return unconfigured();

  const form = await request.formData();
  const body: Record<string, string> = {};
  for (const [k, v] of form.entries()) body[k] = String(v);

  const expected = perfectMoneyHash({
    paymentId: body.PAYMENT_ID ?? "",
    payeeAccount: body.PAYEE_ACCOUNT ?? "",
    paymentAmount: body.PAYMENT_AMOUNT ?? "",
    paymentUnits: body.PAYMENT_UNITS ?? "",
    paymentBatchNum: body.PAYMENT_BATCH_NUM ?? "",
    payerAccount: body.PAYER_ACCOUNT ?? "",
    passphrase: config.passphrase,
    timestampGmt: body.TIMESTAMPGMT ?? "",
  });
  if (!signaturesMatch(expected, body.V2_HASH ?? "")) return badSignature();

  // The account is part of the hash, but the hash only proves the passphrase —
  // it does not prove the money came to *this* operator's account.
  if ((body.PAYEE_ACCOUNT ?? "").toUpperCase() !== (config.payeeAccount ?? "").toUpperCase()) {
    return NextResponse.json({ success: false, message: "Wrong payee" }, { status: 202 });
  }

  const txn = await depositFor(method.id, body.PAYMENT_ID ?? "", config.prefix);
  if (!txn) return unknownReference();

  await creditDeposit(txn.id, body.PAYMENT_BATCH_NUM ?? "", { automatic: true });
  return NextResponse.json({ success: true });
}
