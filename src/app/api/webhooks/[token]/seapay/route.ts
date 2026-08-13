import { NextResponse } from "next/server";
import { handleSePayWebhook } from "@/lib/payments/seapay-webhook";
import { basePrisma } from "@/lib/db-base";
import { runAsPanel } from "@/lib/tenancy";

/**
 * Token-addressed callback.
 *
 * A gateway is configured with one fixed callback URL and posts no hostname we
 * can trust, so the panel is named in the path. The token only selects which
 * panel to run against — the payload is still authenticated against that
 * panel's own webhook secret.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ success: false, message: "Unknown panel" }, { status: 404 });

  const panel = await basePrisma.panel.findFirst({ where: { webhookToken: token } });
  if (!panel) return NextResponse.json({ success: false, message: "Unknown panel" }, { status: 404 });

  return runAsPanel(panel.id, () => handleSePayWebhook(request));
}
