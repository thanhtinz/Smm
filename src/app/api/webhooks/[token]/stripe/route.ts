import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/payments/stripe-webhook";
import { basePrisma } from "@/lib/db-base";
import { runAsPanel } from "@/lib/tenancy";

/**
 * Token-addressed callback: a gateway is configured with one fixed URL and
 * posts no hostname the panel can trust, so the panel is named in the path.
 * The token only selects which panel to run against — the payload is still
 * authenticated against that panel's own signing credentials.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ message: "Unknown panel" }, { status: 404 });

  const panel = await basePrisma.panel.findFirst({ where: { webhookToken: token } });
  if (!panel) return NextResponse.json({ message: "Unknown panel" }, { status: 404 });

  return runAsPanel(panel.id, () => handleStripeWebhook(request));
}
