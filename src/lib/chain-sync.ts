import { db } from "./db";
import { basePrisma } from "./db-base";
import { runAsPanel } from "./tenancy";
import { settleRefund, dispatchPendingOrders, syncOrderStatuses } from "./providers";

/**
 * Carries status and money back down the wholesale chain.
 *
 * The truth about an order lives at the top, where a real provider works on
 * it. Every panel below holds its own copy at its own price, so a status that
 * lands at the root has to walk down, refunding each level's own customer at
 * that level's own charge.
 */

/** Statuses that are worth pushing down; the rest are noise. */
const PROPAGATED = new Set(["processing", "inprogress", "completed", "partial", "canceled", "refunded"]);

/** Once here, the order is settled and further updates would double-refund. */
const TERMINAL = new Set(["completed", "canceled", "refunded"]);

export async function propagateChainStatuses(limit = 200) {
  // Ascending depth means a status reaching the root is carried to the leaf in
  // one pass, instead of one level per cron tick.
  const panels = await basePrisma.panel.findMany({ orderBy: { depth: "asc" } });

  let updated = 0;
  let refunded = 0;

  for (const panel of panels) {
    const upstreams = await runAsPanel(panel.id, async () =>
      db.order.findMany({
        where: { sourceOrderId: { not: "" }, status: { in: [...PROPAGATED] } },
        orderBy: { updatedAt: "asc" },
        take: limit,
      }),
    );

    for (const upstream of upstreams) {
      // The downstream order is in the child panel, so it needs its own scope.
      const downstream = await basePrisma.order.findUnique({ where: { id: upstream.sourceOrderId } });
      if (!downstream) continue;
      if (downstream.status === upstream.status && downstream.remains === upstream.remains) continue;
      if (TERMINAL.has(downstream.status)) continue;

      const data: Record<string, unknown> = { status: upstream.status };
      if (upstream.remains !== downstream.remains) data.remains = upstream.remains;
      if (upstream.startCount !== downstream.startCount) data.startCount = upstream.startCount;

      // Refunds are computed from the downstream order's own charge and
      // rounded down, so no panel can pay out more than it was paid.
      const share =
        upstream.status === "canceled" || upstream.status === "refunded"
          ? downstream.charge
          : upstream.status === "partial" && upstream.remains > 0
            ? Math.floor(
                (downstream.charge * Math.min(upstream.remains, downstream.quantity)) / downstream.quantity,
              )
            : 0;

      await runAsPanel(downstream.panelId, async () => {
        if (share > 0) {
          await settleRefund(
            downstream.id,
            downstream.userId,
            share,
            downstream.publicId,
            data,
            `Refund for order #${downstream.publicId}`,
          );
          refunded += 1;
        } else {
          await db.order.update({ where: { id: downstream.id }, data });
        }
      });

      updated += 1;
    }
  }

  return { updated, refunded };
}

/**
 * One full cycle for every panel: push queued orders to outside providers,
 * pull their statuses back, then carry both down the chain.
 *
 * Cron has no host to resolve a panel from, so each step names its panel.
 */
export async function runSyncCycle() {
  const panels = await basePrisma.panel.findMany({
    where: { status: "active" },
    orderBy: { depth: "asc" },
  });

  let sent = 0;
  let synced = 0;
  const failures: string[] = [];

  for (const panel of panels) {
    const dispatched = await runAsPanel(panel.id, () => dispatchPendingOrders());
    sent += dispatched.sent;
    failures.push(...dispatched.failures.map((f) => `${panel.slug}: ${f}`));

    const pulled = await runAsPanel(panel.id, () => syncOrderStatuses());
    synced += pulled.updated;
    failures.push(...pulled.failures.map((f) => `${panel.slug}: ${f}`));
  }

  const chain = await propagateChainStatuses();
  return { sent, synced, chain, failures };
}
