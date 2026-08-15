import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * ZaloPay, the other wallet this market pays from.
 *
 * Signed differently from MoMo, and the difference matters: the order fields
 * are joined with `|` in a **fixed order the gateway defines**, not sorted, and
 * the two directions use two different keys — key1 for the order this panel
 * sends, key2 for the callback it receives. Using one key for both is the
 * mistake that makes callbacks look forged.
 */

/** The order the gateway defines. Not alphabetical — do not "tidy" it. */
const ORDER_FIELDS = ["app_id", "app_trans_id", "app_user", "amount", "app_time", "embed_data", "item"] as const;

export type ZaloOrder = {
  app_id: string | number;
  app_trans_id: string;
  app_user: string;
  amount: number;
  app_time: number;
  embed_data: string;
  item: string;
};

export function signOrder(order: ZaloOrder, key1: string): string {
  const raw = ORDER_FIELDS.map((f) => String(order[f])).join("|");
  return createHmac("sha256", key1).update(raw).digest("hex");
}

/** The callback signs the raw `data` string it sent, with key2. */
export function signCallback(data: string, key2: string): string {
  return createHmac("sha256", key2).update(data).digest("hex");
}

export function macMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * `app_trans_id` must start with yymmdd and be unique for that day.
 *
 * The panel's own transaction public id goes after the date, which keeps it
 * unique without a second counter and makes the callback trivially matchable
 * back to the deposit it belongs to.
 */
export function appTransId(publicId: number, now: Date): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}_${publicId}`;
}

/** The panel's deposit id, read back off whatever the gateway returns. */
export function publicIdFrom(appTransId: string): number | null {
  const id = Number(appTransId.split("_")[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
