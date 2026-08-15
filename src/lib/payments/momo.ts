import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * MoMo, the wallet most customers in this market actually pay from.
 *
 * MoMo signs both directions with HMAC-SHA256 over a `key=value&key=value`
 * string whose fields are **sorted by name**, keyed by the merchant's secret.
 * The sort is done here rather than a raw string being written out by hand: it
 * is the rule the gateway states, and a hand-written string is one typo away
 * from every payment being rejected with no way to see why.
 *
 * `accessKey` is part of what is signed but is not sent in the body — it is a
 * shared secret proving the caller knows it.
 */

const CREATE_FIELDS = [
  "accessKey",
  "amount",
  "extraData",
  "ipnUrl",
  "orderId",
  "orderInfo",
  "partnerCode",
  "redirectUrl",
  "requestId",
  "requestType",
] as const;

/** The fields MoMo signs on the way back. */
const IPN_FIELDS = [
  "accessKey",
  "amount",
  "extraData",
  "message",
  "orderId",
  "orderInfo",
  "orderType",
  "partnerCode",
  "payType",
  "requestId",
  "responseTime",
  "resultCode",
  "transId",
] as const;

export function momoSignature(fields: readonly string[], values: Record<string, unknown>, secretKey: string): string {
  const raw = [...fields]
    .sort()
    .map((name) => `${name}=${values[name] ?? ""}`)
    .join("&");
  return createHmac("sha256", secretKey).update(raw).digest("hex");
}

export function signCreate(values: Record<string, unknown>, secretKey: string): string {
  return momoSignature(CREATE_FIELDS, values, secretKey);
}

export function signIpn(values: Record<string, unknown>, secretKey: string): string {
  return momoSignature(IPN_FIELDS, values, secretKey);
}

/** Constant-time, and safe against the length mismatch timingSafeEqual throws on. */
export function signatureMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type MomoIpn = {
  partnerCode?: string;
  orderId?: string;
  requestId?: string;
  amount?: number | string;
  orderInfo?: string;
  orderType?: string;
  transId?: number | string;
  resultCode?: number | string;
  message?: string;
  payType?: string;
  responseTime?: number | string;
  extraData?: string;
  signature?: string;
};

/** Zero is the gateway's word for "paid". Everything else is a failure code. */
export function isPaid(resultCode: unknown): boolean {
  return Number(resultCode) === 0;
}
