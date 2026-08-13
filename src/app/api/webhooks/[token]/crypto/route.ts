import { NextResponse } from "next/server";
import { handleCryptoWebhook } from "@/lib/payments/crypto-webhook";
import { basePrisma } from "@/lib/db-base";
import { runAsPanel } from "@/lib/tenancy";

/**
 * Token-addressed callback, for a gateway configured with one fixed URL. The
 * token picks the panel; the IPN signature is still what authenticates.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const panel = token ? await basePrisma.panel.findFirst({ where: { webhookToken: token } }) : null;
  if (!panel) return NextResponse.json({ success: false, message: "Unknown panel" }, { status: 404 });

  return runAsPanel(panel.id, () => handleCryptoWebhook(request));
}
