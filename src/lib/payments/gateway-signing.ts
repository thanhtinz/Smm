import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * The signatures four more gateways speak.
 *
 * Each of these is the only thing standing between a callback and free credit:
 * the body of a payment notification is written by whoever can reach the URL
 * until its signature checks out. Every scheme below is somebody else's, so
 * none of it is invented here — but each is easy to get subtly wrong (the
 * wrong case, the wrong separator, a field left out) and wrong in a way that
 * either rejects real payments or, worse, accepts made-up ones.
 *
 * They are gathered in one file so they can be pinned against reference values
 * computed outside this codebase.
 */

const md5 = (input: string) => createHash("md5").update(input).digest("hex");
const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");
const sha512 = (input: string) => createHash("sha512").update(input).digest("hex");

/** Compares two signatures without leaking how much of one was right. */
export function signaturesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected.trim().toLowerCase(), "utf8");
  const b = Buffer.from(provided.trim().toLowerCase(), "utf8");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

// ------------------------------------------------------------------ Cryptomus

/**
 * Cryptomus signs the base64 of the exact JSON body, concatenated with the
 * merchant's API key, hashed with MD5.
 *
 * "The exact JSON body" is load-bearing in both directions: the request is
 * signed over the bytes that are sent, and a callback is verified over the
 * bytes that arrived. Re-serialising an object before verifying is how a
 * signature that should match stops matching.
 */
export function cryptomusSign(rawJsonBody: string, apiKey: string): string {
  return md5(Buffer.from(rawJsonBody, "utf8").toString("base64") + apiKey);
}

/**
 * A Cryptomus callback, verified.
 *
 * The signature covers the body with its own `sign` field removed, so it is
 * taken out and the rest re-serialised in the order it arrived — which is the
 * order `JSON.parse` preserves.
 */
export function cryptomusWebhookValid(raw: string, apiKey: string): boolean {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return false;
  }

  const provided = String(parsed.sign ?? "");
  if (!provided) return false;

  const { sign: _sign, ...rest } = parsed;
  void _sign;
  return signaturesMatch(cryptomusSign(JSON.stringify(rest), apiKey), provided);
}

// ----------------------------------------------------------------- Binance Pay

/**
 * Binance Pay signs timestamp, nonce and body, each followed by a newline,
 * with HMAC-SHA512 under the API secret, in upper case.
 *
 * The trailing newline after the body is part of it. Leaving it off produces a
 * signature that is wrong in a way no error message explains.
 */
export function binancePaySign(args: { timestamp: string; nonce: string; body: string; secret: string }): string {
  const payload = `${args.timestamp}\n${args.nonce}\n${args.body}\n`;
  return createHmac("sha512", args.secret).update(payload).digest("hex").toUpperCase();
}

// --------------------------------------------------------------------- Payeer

/**
 * Payeer signs a fixed list of fields joined by colons, with the shop's secret
 * key last, hashed with SHA-256 in upper case.
 *
 * The order is the gateway's and is not alphabetical, so the caller passes the
 * fields already in it rather than an object this function would have to
 * guess the order of.
 */
export function payeerSign(fields: string[], secretKey: string): string {
  return sha256([...fields, secretKey].join(":")).toUpperCase();
}

/** The field order Payeer signs a payment form in. */
export function payeerFormFields(args: {
  shopId: string;
  orderId: string;
  amount: string;
  currency: string;
  descriptionBase64: string;
}): string[] {
  return [args.shopId, args.orderId, args.amount, args.currency, args.descriptionBase64];
}

/** The field order Payeer signs a status callback in. */
export function payeerCallbackFields(body: Record<string, string>): string[] {
  return [
    body.m_operation_id ?? "",
    body.m_operation_ps ?? "",
    body.m_operation_date ?? "",
    body.m_operation_pay_date ?? "",
    body.m_shop ?? "",
    body.m_orderid ?? "",
    body.m_amount ?? "",
    body.m_curr ?? "",
    body.m_desc ?? "",
    body.m_status ?? "",
  ];
}

// -------------------------------------------------------------- Perfect Money

/**
 * Perfect Money hashes eight values joined by colons, with the alternate
 * passphrase — itself MD5'd and upper-cased — sitting seventh.
 *
 * There is no API here: the payer is sent through a form and the shop is told
 * about it by a POST whose only proof is this hash.
 */
export function perfectMoneyHash(args: {
  paymentId: string;
  payeeAccount: string;
  paymentAmount: string;
  paymentUnits: string;
  paymentBatchNum: string;
  payerAccount: string;
  passphrase: string;
  timestampGmt: string;
}): string {
  return md5(
    [
      args.paymentId,
      args.payeeAccount,
      args.paymentAmount,
      args.paymentUnits,
      args.paymentBatchNum,
      args.payerAccount,
      md5(args.passphrase).toUpperCase(),
      args.timestampGmt,
    ].join(":"),
  ).toUpperCase();
}

// -------------------------------------------------------- HMAC over raw bytes

/**
 * The commonest scheme there is: HMAC over the exact bytes that arrived.
 *
 * Coinbase Commerce, CoinPayments, OxaPay and Razorpay all do this and differ
 * only in the digest and which header carries the result. Re-serialising the
 * parsed body before hashing is the mistake that breaks every one of them, so
 * the raw text is what this takes.
 */
export function hmacOverBody(raw: string, secret: string, algorithm: "sha256" | "sha512"): string {
  return createHmac(algorithm, secret).update(raw, "utf8").digest("hex");
}

// ------------------------------------------------------------------- Midtrans

/**
 * Midtrans signs four values concatenated with no separator at all, hashed
 * with SHA-512 — the order id, the status code, the gross amount as a string,
 * and the server key.
 *
 * The gross amount has to be the string Midtrans sent, not a number reformatted
 * on the way in: "10000.00" and "10000" hash differently and only one of them
 * is what they signed.
 */
export function midtransSignature(args: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
}): string {
  return sha512(`${args.orderId}${args.statusCode}${args.grossAmount}${args.serverKey}`);
}

// ---------------------------------------------------------------------- PayOS

/**
 * PayOS signs its callback's `data` object as `key=value` pairs sorted by key
 * and joined with "&", under HMAC-SHA256.
 *
 * Sorting is what makes it reproducible: JSON object order is whatever the
 * sender happened to serialise, and hashing it in that order would work right
 * up until they changed a library.
 */
export function payosSignature(data: Record<string, unknown>, checksumKey: string): string {
  const body = Object.keys(data)
    .sort()
    .map((key) => {
      const value = data[key];
      // null and undefined are sent as empty, not as the words.
      return `${key}=${value === null || value === undefined ? "" : String(value)}`;
    })
    .join("&");
  return createHmac("sha256", checksumKey).update(body, "utf8").digest("hex");
}
