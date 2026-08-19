import { NextResponse } from "next/server";
import { handleViettelPayWebhook } from "@/lib/payments/viettelpay-webhook";
import { basePrisma } from "@/lib/db-base";
import { runAsPanel } from "@/lib/tenancy";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ message: "Unknown panel" }, { status: 404 });

  const panel = await basePrisma.panel.findFirst({ where: { webhookToken: token } });
  if (!panel) return NextResponse.json({ message: "Unknown panel" }, { status: 404 });

  return runAsPanel(panel.id, () => handleViettelPayWebhook(request));
}
