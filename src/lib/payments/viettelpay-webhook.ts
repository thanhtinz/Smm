import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditDeposit } from "./credit";
import { parseConfig, underpaid } from "./index";
import { checksumMatches, isPaid, signIpn, type ViettelIpn } from "./viettelpay";

export async function handleViettelPayWebhook(request: Request) {
  const method = await db.paymentMethod.findFirst({ where: { driver: "viettelpay" } });
  if (!method || !method.enabled) {
    return NextResponse.json({ error_code: "99", message: "Method disabled" }, { status: 404 });
  }

  const secretKey = parseConfig(method.config).secretKey?.trim();
  if (!secretKey) {
    return NextResponse.json({ error_code: "99", message: "Not configured" }, { status: 503 });
  }

  let payload: ViettelIpn;
  try {
    payload = (await request.json()) as ViettelIpn;
  } catch {
    return NextResponse.json({ error_code: "99", message: "Invalid JSON" }, { status: 400 });
  }

  const expected = signIpn(payload, secretKey);
  if (!checksumMatches(expected, String(payload.check_sum ?? ""))) {
    return NextResponse.json({ error_code: "99", message: "Bad checksum" }, { status: 401 });
  }

  if (!isPaid(payload.response_code)) {
    return NextResponse.json({ error_code: "00", message: "Not a successful payment" });
  }

  const publicId = Number(/(\d{3,})$/.exec(String(payload.order_id ?? ""))?.[1]);
  if (!Number.isInteger(publicId)) {
    return NextResponse.json({ error_code: "00", message: "Unknown reference" });
  }

  const txn = await db.transaction.findFirst({
    where: { publicId, type: "deposit", methodId: method.id },
  });
  if (!txn) return NextResponse.json({ error_code: "00", message: "Unknown reference" });

  const received = Number(payload.amount ?? 0);
  if (await underpaid(received, txn.paidAmount, txn.currency)) {
    await db.transaction.update({
      where: { id: txn.id },
      data: { note: `Underpaid: received ${received}, expected ${txn.paidAmount}` },
    });
    return NextResponse.json({ error_code: "00", message: "Amount is lower than the deposit" });
  }

  const result = await creditDeposit(txn.id, String(payload.transaction_id ?? ""), { automatic: true });
  return NextResponse.json({ error_code: "00", message: result });
}
