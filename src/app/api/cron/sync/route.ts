import { NextResponse } from "next/server";
import { runSyncCycle } from "@/lib/chain-sync";

/**
 * Scheduler entry point: dispatches queued orders, refreshes statuses from
 * outside providers, and carries both down the wholesale chain — for every
 * panel, since a cron request has no host to resolve one from.
 *
 * Protected by CRON_SECRET so it cannot be triggered by a stranger. Without
 * the variable set the route stays closed rather than open.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });

  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runSyncCycle();

  return NextResponse.json({
    dispatched: result.sent,
    updated: result.synced,
    chain: result.chain,
    failures: result.failures,
  });
}
