import { db } from "./db";
import { basePrisma } from "./db-base";
import { getSetting } from "./settings";
import { runAsPanel } from "./tenancy";
import { settleRefund } from "./providers";
import { resolveRequest } from "./requests";
import { englishMessage } from "./fault";

/**
 * The decisions a panel can make without an operator at the keyboard.
 *
 * Both are deliberately narrow. A refill is approved only where the answer
 * was never in doubt — the service offers it and the order is inside the
 * window the panel itself advertises. A cancel is approved only while
 * nothing has been bought yet upstream, which is exactly when it costs the
 * panel nothing. Everything else still waits for a human, because the cases
 * that need judgement are the ones where money is already spent.
 */

export type AutoReport = {
  refills: number;
  cancels: number;
  stuck: number;
  failures: string[];
};

/** Refill is only meaningful once delivery has finished or stalled. */
const REFILLABLE = new Set(["completed", "partial"]);

/**
 * Nothing has been bought for this order yet: no provider order id, and no
 * order on the panel above. Cancelling it is free, which is what makes it
 * safe to do unattended.
 */
async function nothingSpentYet(orderId: string): Promise<boolean> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, providerOrderId: true },
  });
  if (!order || order.providerOrderId) return false;
  if (order.status !== "pending") return false;

  const upstream = await basePrisma.order.count({ where: { sourceOrderId: orderId } });
  return upstream === 0;
}

async function autoResolveOne(
  request: { id: string; type: string; publicId: number; orderId: string },
  report: AutoReport,
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: request.orderId },
    include: { service: { select: { refill: true, cancel: true } } },
  });
  if (!order) return;

  if (request.type === "refill") {
    if (!order.service.refill || !REFILLABLE.has(order.status)) return;

    // The same window the customer was told about, checked again here so a
    // request that sat in the queue past it is not waved through.
    const days = Number(await getSetting("order.refillWindowDays")) || 0;
    if (days > 0 && order.updatedAt.getTime() < Date.now() - days * 864e5) return;

    const outcome = await resolveRequest(request.id, "approved", "Approved automatically");
    // A cron pass has no reader, so its report is written in English.
    if ("key" in outcome) report.failures.push(`refill #${request.publicId}: ${englishMessage(outcome.key, outcome.vars)}`);
    else report.refills += 1;
    return;
  }

  if (!order.service.cancel) return;
  if (!(await nothingSpentYet(request.orderId))) return;

  const outcome = await resolveRequest(request.id, "approved", "Approved automatically");
  if ("key" in outcome) report.failures.push(`cancel #${request.publicId}: ${englishMessage(outcome.key, outcome.vars)}`);
  else report.cancels += 1;
}

/**
 * Cancels orders that should have reached a provider and never did.
 *
 * Only orders whose service is mapped to a provider count: a service with no
 * provider is fulfilled by hand and is meant to sit in the queue. Refunding
 * uses the same path as a provider cancellation, so the money comes back the
 * same way and a second pass cannot pay twice.
 */
async function cancelStuckOrders(report: AutoReport): Promise<void> {
  const minutes = Number(await getSetting("order.stuckAfterMinutes")) || 0;
  if (minutes <= 0) return;

  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stuck = await db.order.findMany({
    where: {
      status: "pending",
      providerOrderId: "",
      createdAt: { lt: cutoff },
      service: { providerId: { not: null } },
    },
    take: 50,
  });

  for (const order of stuck) {
    await settleRefund(
      order.id,
      order.userId,
      order.charge,
      order.publicId,
      { status: "canceled", remains: 0, note: `Cancelled automatically after ${minutes} minutes unsent` },
      `Order #${order.publicId} could not be sent to the provider`,
    );
    report.stuck += 1;
  }
}

/** One pass over every panel, since cron has no host to resolve one from. */
export async function runAutoDecisions(): Promise<AutoReport> {
  const report: AutoReport = { refills: 0, cancels: 0, stuck: 0, failures: [] };
  const panels = await basePrisma.panel.findMany({ where: { status: "active" }, select: { id: true, slug: true } });

  for (const panel of panels) {
    await runAsPanel(panel.id, async () => {
      const [autoRefill, autoCancel] = await Promise.all([
        getSetting("order.autoApproveRefill"),
        getSetting("order.autoApproveCancel"),
      ]);

      const wanted = [autoRefill ? "refill" : "", autoCancel ? "cancel" : ""].filter(Boolean);
      if (wanted.length) {
        const pending = await db.orderRequest.findMany({
          where: { status: "pending", type: { in: wanted } },
          orderBy: { createdAt: "asc" },
          take: 50,
        });
        for (const request of pending) {
          try {
            await autoResolveOne(request, report);
          } catch (error) {
            report.failures.push(`${panel.slug}: ${error instanceof Error ? error.message : "failed"}`);
          }
        }
      }

      try {
        await cancelStuckOrders(report);
      } catch (error) {
        report.failures.push(`${panel.slug} stuck: ${error instanceof Error ? error.message : "failed"}`);
      }
    });
  }

  return report;
}
