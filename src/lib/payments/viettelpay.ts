import { createHash, timingSafeEqual } from "node:crypto";

const ORDER_FIELDS = [
  "amount",
  "currency",
  "merchant_code",
  "notify_url",
  "order_desc",
  "order_id",
  "return_url",
  "version",
] as const;

const IPN_FIELDS = ["amount", "merchant_code", "order_id", "response_code", "transaction_id", "version"] as const;

function checksum(fields: readonly string[], values: Record<string, unknown>, secretKey: string): string {
  const raw =
    [...fields]
      .sort()
      .map((name) => `${name}=${values[name] ?? ""}`)
      .join("") + secretKey;
  return createHash("md5").update(raw).digest("hex");
}

export function signOrder(values: Record<string, unknown>, secretKey: string): string {
  return checksum(ORDER_FIELDS, values, secretKey);
}

export function signIpn(values: Record<string, unknown>, secretKey: string): string {
  return checksum(IPN_FIELDS, values, secretKey);
}

export function checksumMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isPaid(responseCode: string | number | undefined): boolean {
  return String(responseCode ?? "") === "00";
}

export type ViettelIpn = {
  merchant_code?: string;
  order_id?: string;
  amount?: number | string;
  response_code?: string | number;
  transaction_id?: string | number;
  version?: string;
  check_sum?: string;
};
