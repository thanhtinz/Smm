import { floorMoney } from "./money";
import { getBaseCurrency } from "./currency";
import { db } from "./db";
import { basePrisma } from "./db-base";
import { runAsPanel } from "./tenancy";
import { settleRefund, dispatchPendingOrders, syncOrderStatuses } from "./providers";
import { billPanelRent } from "./billing";
import { getSetting } from "./settings";
import { updateExchangeRates } from "./exchange";
import { syncDueProviders } from "./provider-sync";
import { runAutoDecisions } from "./auto-orders";
import { notification, requestKey } from "./notify";
import { englishMessage } from "./fault";
import { sendPendingNotificationMails } from "./notify-mail";
import { withSettled, recordOrderStep } from "./orders";
import { deliverCallbacks } from "./callbacks";
import { checkDueRanks } from "./rank/tracker";

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
  // Currencies are global, so the base's precision is the same at every hop.
  const money = (await getBaseCurrency()).decimals;

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
            ? floorMoney(
                (downstream.charge * Math.min(upstream.remains, downstream.quantity)) / downstream.quantity,
                money,
              )
            : 0;

      await runAsPanel(downstream.panelId, async () => {
        if (share > 0) {
          await settleRefund(
            downstream.id,
            downstream.userId,
            share,
            downstream.publicId,
            withSettled(data),
            `Refund for order #${downstream.publicId}`,
            downstream.charge,
          );
          refunded += 1;
        } else {
          await db.order.update({ where: { id: downstream.id }, data: withSettled(data) });
        }
        // The panel above decided this, so that is what the timeline says.
        await recordOrderStep(db, downstream, data, "chain");
      });

      updated += 1;
    }
  }

  return { updated, refunded };
}

/**
 * Carries a resolved refill or cancel request back down to the reseller who
 * raised it.
 *
 * A panel that forwarded a request left its own copy `approved`, meaning
 * "passed on". It only reaches a final answer when the level above reaches
 * one. Cancels need no money moved here: when the cancel actually happens the
 * order status changes, and the refund cascade above handles it.
 */
export async function propagateRequestDecisions(limit = 200) {
  const panels = await basePrisma.panel.findMany({ orderBy: { depth: "asc" } });
  let updated = 0;

  for (const panel of panels) {
    const resolved = await runAsPanel(panel.id, async () =>
      db.orderRequest.findMany({
        where: { sourceRequestId: { not: "" }, status: { in: ["rejected", "completed"] } },
        orderBy: { updatedAt: "asc" },
        take: limit,
      }),
    );

    for (const upstream of resolved) {
      const downstream = await basePrisma.orderRequest.findUnique({
        where: { id: upstream.sourceRequestId },
        include: { order: { select: { publicId: true } } },
      });
      if (!downstream || downstream.status === upstream.status) continue;
      if (downstream.status === "rejected" || downstream.status === "completed") continue;

      await runAsPanel(downstream.panelId, async () => {
        await db.orderRequest.update({
          where: { id: downstream.id },
          data: { status: upstream.status, note: upstream.note },
        });
        await db.notification.create({
          data: notification({
            userId: downstream.userId,
            key: requestKey(downstream.type, upstream.status),
            params: { orderId: downstream.order.publicId, ...(upstream.note ? { note: upstream.note } : {}) },
            level: upstream.status === "rejected" ? "warning" : "success",
            href: "/dashboard/orders",
          }),
        });
      });

      updated += 1;
    }
  }

  return { updated };
}

/**
 * One full cycle for every panel: push queued orders to outside providers,
 * pull their statuses back, then carry both down the chain.
 *
 * Cron has no host to resolve a panel from, so each step names its panel.
 */
/**
 * Runs one step and lets the cycle survive it.
 *
 * Every step below was a bare `await` in a row of twelve, with no try/catch
 * anywhere in the function. Provider calls are already guarded — they return a
 * result rather than throwing — so the ordinary failure was handled. Anything
 * else was not: one Prisma constraint, one UPSTREAM_FUNDS thrown out of a
 * chain write, one bad row, and the whole cycle died for *every* panel. No
 * orders dispatched, no statuses pulled, no refunds settled, no rent billed,
 * no mail sent, and no finishedAt written — the deployment's entire order
 * pipeline stopped until somebody noticed.
 *
 * A step that throws is now recorded like any other failure and the next one
 * runs. `fallback` is what the cycle reports for a step that did not finish,
 * so the return shape does not change.
 */
export async function step<T>(label: string, fallback: T, failures: string[], run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

export async function runSyncCycle(trigger = "cron") {
  // Opened before any work and closed after it, so a cycle that dies halfway
  // leaves a row with no finishedAt — which is the difference between "the
  // scheduler stopped calling" and "the scheduler called and something broke".
  const run = await basePrisma.syncRun.create({ data: { trigger } });

  const panels = await basePrisma.panel.findMany({
    where: { status: "active" },
    orderBy: { depth: "asc" },
  });

  let sent = 0;
  let synced = 0;
  const failures: string[] = [];

  // One panel throwing must not cost the others their turn, so each panel's
  // two steps are wrapped separately.
  for (const panel of panels) {
    // A panel can hold its queue for an operator to send by hand; the button
    // in the admin area sends regardless, which is what makes that workable.
    const auto = await step(`${panel.slug}: settings`, false, failures, () =>
      runAsPanel(panel.id, () => getSetting("order.autoSendToProvider")),
    );
    if (auto) {
      const dispatched = await step(`${panel.slug}: dispatch`, { sent: 0, failures: [] as string[] }, failures, () =>
        runAsPanel(panel.id, () => dispatchPendingOrders()),
      );
      sent += dispatched.sent;
      failures.push(...dispatched.failures.map((f) => `${panel.slug}: ${f}`));
    }

    const pulled = await step(`${panel.slug}: sync`, { updated: 0, failures: [] as string[] }, failures, () =>
      runAsPanel(panel.id, () => syncOrderStatuses()),
    );
    synced += pulled.updated;
    failures.push(...pulled.failures.map((f) => `${panel.slug}: ${f}`));
  }

  // Before the chain pass, so a request approved here travels the same cycle
  // rather than waiting for the next one.
  const auto = await step("auto decisions", { refills: 0, cancels: 0, stuck: 0, failures: [] as string[] }, failures, () =>
    runAutoDecisions(),
  );
  failures.push(...auto.failures);

  const chain = await step("chain statuses", { updated: 0, refunded: 0 }, failures, () => propagateChainStatuses());
  const requests = await step("chain requests", { updated: 0 }, failures, () => propagateRequestDecisions());

  // After the chain pass, so a status that walked down three panels tells
  // every reseller on the way in the same cycle it arrived.
  const callbacks = await step("callbacks", { sent: 0, failed: 0, retrying: 0 }, failures, () => deliverCallbacks());
  const rent = await step("rent", [] as Awaited<ReturnType<typeof billPanelRent>>, failures, () => billPanelRent());

  // Last: everything above may have written notifications, and each of them
  // is a candidate for an email on this same pass rather than the next one.
  const mailed = await step("mail", { sent: 0, failures: [] as string[] }, failures, () =>
    sendPendingNotificationMails(),
  );
  failures.push(...mailed.failures);
  const rates = await step("rates", { skipped: "step failed" } as Awaited<ReturnType<typeof updateExchangeRates>>, failures, () =>
    updateExchangeRates(),
  );

  // Rankings move slowly and cost money to ask about, so this rides the same
  // cycle rather than a schedule of its own; the interval setting is what
  // decides whether a given tick actually reads anything.
  const ranks = await step("ranks", { panels: 0, checked: 0, failures: [] as string[] }, failures, () => checkDueRanks());
  failures.push(...ranks.failures);

  // Last: a repriced catalogue should not change what the orders dispatched a
  // moment ago were charged at.
  const catalogue = await step("catalogue", [] as Awaited<ReturnType<typeof syncDueProviders>>, failures, () =>
    syncDueProviders(),
  );
  failures.push(
    ...catalogue
      .filter((r) => r.fault)
      .map((r) => `${r.provider}: ${englishMessage(r.fault!.key, r.fault!.vars)}`),
  );

  await basePrisma.syncRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), dispatched: sent, synced, mailed: mailed.sent, failures: failures.join("\n") },
  });

  return {
    sent,
    synced,
    mailed: mailed.sent,
    chain,
    requests,
    callbacks,
    ranks,
    rent,
    rates,
    auto: { refills: auto.refills, cancels: auto.cancels, stuck: auto.stuck },
    catalogue: catalogue.map((r) => ({
      provider: r.provider,
      repriced: r.repriced,
      missing: r.missing,
      alerts: r.alerts.length,
    })),
    failures,
  };
}
