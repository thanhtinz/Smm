import { NextResponse } from "next/server";
import { handleCryptoWebhook } from "@/lib/payments/crypto-webhook";
import { getCurrentPanel } from "@/lib/tenancy";

/** Host-addressed callback, for a panel configured with its own domain. */
export async function POST(request: Request) {
  if (!(await getCurrentPanel())) {
    return NextResponse.json({ success: false, message: "Unknown panel" }, { status: 404 });
  }
  return handleCryptoWebhook(request);
}
