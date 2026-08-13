import { NextResponse } from "next/server";
import { handleSePayWebhook } from "@/lib/payments/seapay-webhook";
import { getCurrentPanel } from "@/lib/tenancy";

/**
 * Host-addressed callback, kept because it is the URL panels were already
 * configured with. A panel whose gateway posts to a different hostname uses
 * the token URL instead.
 */
export async function POST(request: Request) {
  if (!(await getCurrentPanel())) {
    return NextResponse.json({ success: false, message: "Unknown panel" }, { status: 404 });
  }
  return handleSePayWebhook(request);
}
