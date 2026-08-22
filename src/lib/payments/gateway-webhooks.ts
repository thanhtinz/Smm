import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditDeposit, failDeposit } from "./credit";
import { parseConfig } from "./index";
import {
  cryptomusWebhookValid,
  binancePaySign,
  hmacOverBody,
  midtransSignature,
  payosSignature,
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

// ---------------------------------------------------- HMAC-over-body gateways

/**
 * Four gateways, one shape.
 *
 * Coinbase Commerce, CoinPayments, OxaPay and Razorpay all sign the exact
 * bytes of the callback and differ only in the digest, the header, and where
 * the reference and the status sit in the body. Writing that out four times
 * would be four chances to verify a signature and then forget to check the
 * status, so it is written once.
 */
async function hmacGateway(
  request: Request,
  spec: {
    driver: string;
    secretField: string;
    header: string;
    algorithm: "sha256" | "sha512";
    /** Reads the reference and what happened, from the parsed body. */
    read: (body: Record<string, unknown>) => { reference: string; paid: boolean; dead: boolean; id: string };
    /** Form-encoded rather than JSON, as CoinPayments is. */
    form?: boolean;
  },
) {
  const found = await methodFor(spec.driver);
  if (!found) return disabled();
  const { method, config } = found;
  const secret = config[spec.secretField]?.trim();
  if (!secret) return unconfigured();

  // Read once as text: the signature covers these exact bytes, and parsing
  // then re-serialising would change them.
  const raw = await request.text();
  const provided = request.headers.get(spec.header) ?? "";
  if (!provided || !signaturesMatch(hmacOverBody(raw, secret, spec.algorithm), provided)) return badSignature();

  let body: Record<string, unknown> = {};
  if (spec.form) {
    body = Object.fromEntries(new URLSearchParams(raw).entries());
  } else {
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
    }
  }

  const { reference, paid, dead, id } = spec.read(body);
  const txn = await depositFor(method.id, reference, config.prefix);
  if (!txn) return unknownReference();

  if (dead) {
    await failDeposit(txn.id, `${spec.driver} payment failed`);
    return NextResponse.json({ success: true, message: "failed" });
  }
  if (!paid) return NextResponse.json({ success: true, message: "ignored" });

  return NextResponse.json({ success: true, message: await creditDeposit(txn.id, id, { automatic: true }) });
}

export function handleCoinbaseWebhook(request: Request) {
  return hmacGateway(request, {
    driver: "coinbase",
    secretField: "webhookSecret",
    header: "x-cc-webhook-signature",
    algorithm: "sha256",
    read: (body) => {
      const event = (body.event ?? {}) as Record<string, unknown>;
      const data = (event.data ?? {}) as Record<string, unknown>;
      const type = String(event.type ?? "");
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      return {
        reference: String(metadata.reference ?? data.code ?? ""),
        paid: type === "charge:confirmed",
        dead: type === "charge:failed" || type === "charge:expired",
        id: String(data.code ?? ""),
      };
    },
  });
}

export function handleCoinPaymentsWebhook(request: Request) {
  return hmacGateway(request, {
    driver: "coinpayments",
    secretField: "ipnSecret",
    header: "hmac",
    algorithm: "sha512",
    form: true,
    read: (body) => {
      // 100 and 2 are "complete"; anything below zero is cancelled or timed out.
      const status = Number(body.status ?? 0);
      return {
        reference: String(body.item_number ?? ""),
        paid: status >= 100 || status === 2,
        dead: status < 0,
        id: String(body.txn_id ?? ""),
      };
    },
  });
}

export function handleOxapayWebhook(request: Request) {
  return hmacGateway(request, {
    driver: "oxapay",
    secretField: "merchantApiKey",
    header: "hmac",
    algorithm: "sha512",
    read: (body) => {
      const status = String(body.status ?? "").toLowerCase();
      return {
        reference: String(body.orderId ?? ""),
        paid: status === "paid",
        dead: status === "expired" || status === "failed",
        id: String(body.trackId ?? ""),
      };
    },
  });
}

export function handleRazorpayWebhook(request: Request) {
  return hmacGateway(request, {
    driver: "razorpay",
    secretField: "webhookSecret",
    header: "x-razorpay-signature",
    algorithm: "sha256",
    read: (body) => {
      const payload = (body.payload ?? {}) as Record<string, unknown>;
      const entity =
        (((payload.payment_link ?? {}) as Record<string, unknown>).entity ?? {}) as Record<string, unknown>;
      const payment = (((payload.payment ?? {}) as Record<string, unknown>).entity ?? {}) as Record<string, unknown>;
      const event = String(body.event ?? "");
      return {
        reference: String(entity.reference_id ?? payment.notes ?? ""),
        paid: event === "payment_link.paid",
        dead: event === "payment_link.cancelled" || event === "payment_link.expired",
        id: String(payment.id ?? entity.id ?? ""),
      };
    },
  });
}

// ------------------------------------------------------------------- Midtrans

export async function handleMidtransWebhook(request: Request) {
  const found = await methodFor("midtrans");
  if (!found) return disabled();
  const { method, config } = found;
  if (!config.serverKey) return unconfigured();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const expected = midtransSignature({
    orderId: String(body.order_id ?? ""),
    statusCode: String(body.status_code ?? ""),
    // Hashed as the string they sent, not as a number reformatted here.
    grossAmount: String(body.gross_amount ?? ""),
    serverKey: config.serverKey,
  });
  if (!signaturesMatch(expected, String(body.signature_key ?? ""))) return badSignature();

  const txn = await depositFor(method.id, String(body.order_id ?? ""), config.prefix);
  if (!txn) return unknownReference();

  const status = String(body.transaction_status ?? "").toLowerCase();
  if (["deny", "cancel", "expire", "failure"].includes(status)) {
    await failDeposit(txn.id, `Midtrans payment ${status}`);
    return NextResponse.json({ success: true, message: status });
  }
  // "capture" only counts once fraud review has passed.
  const accepted =
    status === "settlement" || (status === "capture" && String(body.fraud_status ?? "accept") === "accept");
  if (!accepted) return NextResponse.json({ success: true, message: `ignored ${status || "unknown"}` });

  return NextResponse.json({
    success: true,
    message: await creditDeposit(txn.id, String(body.transaction_id ?? ""), { automatic: true }),
  });
}

// --------------------------------------------------------------------- Xendit

/**
 * Xendit does not sign anything: it sends back the verification token the
 * operator configured, in a header. That makes the token a shared secret, so
 * it is compared the same way a signature is.
 */
export async function handleXenditWebhook(request: Request) {
  const found = await methodFor("xendit");
  if (!found) return disabled();
  const { method, config } = found;
  if (!config.callbackToken) return unconfigured();

  if (!signaturesMatch(config.callbackToken, request.headers.get("x-callback-token") ?? "")) return badSignature();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const txn = await depositFor(method.id, String(body.external_id ?? ""), config.prefix);
  if (!txn) return unknownReference();

  const status = String(body.status ?? "").toUpperCase();
  if (status === "EXPIRED" || status === "FAILED") {
    await failDeposit(txn.id, `Xendit invoice ${status.toLowerCase()}`);
    return NextResponse.json({ success: true, message: status });
  }
  if (status !== "PAID" && status !== "SETTLED") {
    return NextResponse.json({ success: true, message: `ignored ${status || "unknown"}` });
  }

  return NextResponse.json({
    success: true,
    message: await creditDeposit(txn.id, String(body.id ?? ""), { automatic: true }),
  });
}

// ---------------------------------------------------------------------- PayOS

export async function handlePayosWebhook(request: Request) {
  const found = await methodFor("payos");
  if (!found) return disabled();
  const { method, config } = found;
  if (!config.checksumKey) return unconfigured();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  if (!signaturesMatch(payosSignature(data, config.checksumKey), String(body.signature ?? ""))) {
    return badSignature();
  }

  // PayOS addresses the deposit by its own number rather than by a reference
  // string, which is why this one does not go through depositFor.
  const orderCode = Number(data.orderCode ?? 0);
  const txn = orderCode
    ? await db.transaction.findFirst({ where: { publicId: orderCode, type: "deposit", methodId: method.id } })
    : null;
  if (!txn) return unknownReference();

  const paid = String(body.code ?? data.code ?? "") === "00" && Boolean(body.success ?? true);
  if (!paid) {
    await failDeposit(txn.id, "PayOS payment failed");
    return NextResponse.json({ success: true, message: "failed" });
  }

  return NextResponse.json({
    success: true,
    message: await creditDeposit(txn.id, String(data.reference ?? ""), { automatic: true }),
  });
}
