import { NextResponse } from "next/server";
import { handleMidtransWebhook } from "@/lib/payments/gateway-webhooks";
import { basePrisma } from "@/lib/db-base";
import { runAsPanel } from "@/lib/tenancy";

/**
 * Token-addressed callback. The token picks the panel; the signature inside
 * is still what authenticates the payment.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const panel = token ? await basePrisma.panel.findFirst({ where: { webhookToken: token } }) : null;
  if (!panel) return NextResponse.json({ success: false, message: "Unknown panel" }, { status: 404 });

  return runAsPanel(panel.id, () => handleMidtransWebhook(request));
}
