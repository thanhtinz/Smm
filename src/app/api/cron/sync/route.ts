import { timingSafeEqual } from "crypto";
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

  // Compared byte by byte in constant time, the way the payment webhooks
  // compare theirs. `!==` returns as soon as two characters differ, which
  // leaks the secret one character at a time to anyone patient enough to
  // measure — and this endpoint dispatches every order in the deployment.
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSyncCycle();

  return NextResponse.json({
    dispatched: result.sent,
    updated: result.synced,
    mailed: result.mailed,
    chain: result.chain,
    requests: result.requests,
    callbacks: result.callbacks,
    ranks: result.ranks,
    catalogue: result.catalogue,
    auto: result.auto,
    rent: result.rent,
    rates: result.rates,
    failures: result.failures,
  });
}
