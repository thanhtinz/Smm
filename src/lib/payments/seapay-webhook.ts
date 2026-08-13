import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditDeposit } from "./credit";
import { parseConfig } from "./index";

/**
 * SePay posts one object per bank transaction. We match the deposit by the
 * reference we encoded into the QR, confirm the amount covers what was asked
 * for, then credit — idempotently, because SePay retries.
 *
 * Auth: `Authorization: Apikey <webhookSecret>`, compared against the value
 * stored on the payment method in the admin area.
 *
 * Runs against whichever panel the caller established, either from the host or
 * from the token in the URL.
 */
export async function handleSePayWebhook(request: Request) {
  const method = await db.paymentMethod.findFirst({ where: { code: "seapay" } });
  if (!method || !method.enabled) {
    return NextResponse.json({ success: false, message: "Method disabled" }, { status: 404 });
  }

  const config = parseConfig(method.config);
  const expected = config.webhookSecret?.trim();
  if (expected) {
    const header = request.headers.get("authorization") ?? "";
    const provided = header.replace(/^Apikey\s+/i, "").trim();
    if (provided !== expected) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: SePayPayload;
  try {
    payload = (await request.json()) as SePayPayload;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  // Only money coming in can settle a deposit.
  if (payload.transferType && payload.transferType !== "in") {
    return NextResponse.json({ success: true, message: "Ignored outgoing transfer" });
  }

  const content = `${payload.content ?? ""} ${payload.description ?? ""} ${payload.code ?? ""}`;
  const prefix = (config.prefix || "NOVA").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "NOVA";
  const match = content.toUpperCase().match(new RegExp(`${prefix}(\\d{3,})`));
  if (!match) {
    return NextResponse.json({ success: false, message: "No reference found in transfer content" }, { status: 202 });
  }

  const publicId = Number(match[1]);
  const txn = await db.transaction.findFirst({
    where: { publicId, type: "deposit", methodId: method.id },
  });
  if (!txn) {
    return NextResponse.json({ success: false, message: "Unknown reference" }, { status: 202 });
  }

  const received = Number(payload.transferAmount ?? 0);
  if (received + 1 < txn.paidAmount) {
    await db.transaction.update({
      where: { id: txn.id },
      data: { note: `Underpaid: received ${received}, expected ${txn.paidAmount}` },
    });
    return NextResponse.json({ success: false, message: "Amount is lower than the deposit" }, { status: 202 });
  }

  const result = await creditDeposit(txn.id, String(payload.id ?? payload.referenceCode ?? ""));
  return NextResponse.json({ success: true, message: result });
}

type SePayPayload = {
  id?: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  code?: string | null;
  content?: string;
  description?: string;
  transferType?: "in" | "out";
  transferAmount?: number;
  referenceCode?: string;
};
