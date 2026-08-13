import { NextResponse } from "next/server";
import { dispatchPendingOrders, syncOrderStatuses } from "@/lib/providers";

/**
 * Scheduler entry point: dispatches queued orders and refreshes statuses.
 * Protected by CRON_SECRET so it cannot be triggered by a stranger. Without
 * the variable set the route stays closed rather than open.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });

  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dispatched = await dispatchPendingOrders();
  const synced = await syncOrderStatuses();

  return NextResponse.json({
    dispatched: dispatched.sent,
    updated: synced.updated,
    failures: [...dispatched.failures, ...synced.failures],
  });
}
