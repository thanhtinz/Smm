import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditDeposit } from "./credit";
import { parseConfig } from "./index";
import { macMatches, publicIdFrom, signCallback } from "./zalopay";

/**
 * ZaloPay's callback.
 *
 * It posts `{ data, mac }` where `data` is a JSON *string* and the MAC is over
 * those exact bytes. So the string is verified first and parsed second —
 * re-serialising the parsed object would produce different bytes and a
 * signature that never matches.
 *
 * The reply shape is part of the contract: `return_code: 1` means "received,
 * stop retrying"; anything else has ZaloPay try again.
 */
export async function handleZaloPayWebhook(request: Request) {
  const method = await db.paymentMethod.findFirst({ where: { driver: "zalopay" } });
  if (!method || !method.enabled) {
    return NextResponse.json({ return_code: 0, return_message: "Method disabled" });
  }

  const key2 = parseConfig(method.config).key2?.trim();
  if (!key2) {
    return NextResponse.json({ return_code: 0, return_message: "Not configured" });
  }

  let body: { data?: string; mac?: string };
  try {
    body = (await request.json()) as { data?: string; mac?: string };
  } catch {
    return NextResponse.json({ return_code: 0, return_message: "Invalid JSON" });
  }

  const raw = String(body.data ?? "");
  if (!raw || !macMatches(signCallback(raw, key2), String(body.mac ?? ""))) {
    // return_code -1 is the gateway's "do not retry, this was rejected".
    return NextResponse.json({ return_code: -1, return_message: "Bad mac" });
  }

  let data: { app_trans_id?: string; amount?: number | string; zp_trans_id?: number | string };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return NextResponse.json({ return_code: -1, return_message: "Invalid data" });
  }

  const publicId = publicIdFrom(String(data.app_trans_id ?? ""));
  if (!publicId) return NextResponse.json({ return_code: 1, return_message: "Unknown reference" });

  const txn = await db.transaction.findFirst({
    where: { publicId, type: "deposit", methodId: method.id },
  });
  if (!txn) return NextResponse.json({ return_code: 1, return_message: "Unknown reference" });

  const received = Number(data.amount ?? 0);
  if (received + 1 < txn.paidAmount) {
    await db.transaction.update({
      where: { id: txn.id },
      data: { note: `Underpaid: received ${received}, expected ${txn.paidAmount}` },
    });
    return NextResponse.json({ return_code: 1, return_message: "Amount is lower than the deposit" });
  }

  const result = await creditDeposit(txn.id, String(data.zp_trans_id ?? ""), { automatic: true });
  return NextResponse.json({ return_code: 1, return_message: result });
}
