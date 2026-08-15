import { basePrisma } from "./db-base";
import { runAsPanel } from "./tenancy";
import { getSetting } from "./settings";
import { dispatchPendingOrders, syncOrderStatuses } from "./providers";
import { runAutoDecisions } from "./auto-orders";
import { propagateChainStatuses, propagateRequestDecisions } from "./chain-sync";
import { deliverCallbacks } from "./callbacks";
import { billPanelRent } from "./billing";
import { sendPendingNotificationMails } from "./notify-mail";
import { updateExchangeRates } from "./exchange";
import { checkDueRanks } from "./rank/tracker";
import { syncDueProviders } from "./provider-sync";
import { englishMessage } from "./fault";

/**
 * The scheduled work, named and individually runnable.
 *
 * The cycle already existed and ran all of this in one pass, which is right
 * for a scheduler: the order matters and one call is one thing to configure.
 * What it could not do is run *one* of them. When callbacks are stuck or one
 * provider's catalogue is stale, an operator had the choice of running
 * everything — dispatching orders, billing rent, sending mail — or nothing.
 *
 * So the same work is listed here as jobs. The cycle keeps its own hand-written
 * order; this is the registry the admin screen reads and the buttons call.
 */

export type JobResult = { summary: string; failures: string[] };

export type CronJob = {
  key: string;
  /** Whether an operator running this alone can do damage. */
  moves: "orders" | "money" | "nothing";
  run: () => Promise<JobResult>;
};

const none: string[] = [];

/** Every active panel, in the order the cycle walks them. */
async function eachPanel<T>(fn: () => Promise<T>): Promise<{ panel: string; result: T }[]> {
  const panels = await basePrisma.panel.findMany({ where: { status: "active" }, orderBy: { depth: "asc" } });
  const out: { panel: string; result: T }[] = [];
  for (const panel of panels) out.push({ panel: panel.slug, result: await runAsPanel(panel.id, fn) });
  return out;
}

export const CRON_JOBS: CronJob[] = [
  {
    key: "dispatch",
    moves: "orders",
    async run() {
      let sent = 0;
      const failures: string[] = [];
      for (const { panel, result } of await eachPanel(async () => {
        // A panel can hold its queue for an operator to send by hand. Pressing
        // the button here is that operator, so it sends regardless — which is
        // the whole point of being able to hold the queue.
        void (await getSetting("order.autoSendToProvider"));
        return dispatchPendingOrders();
      })) {
        sent += result.sent;
        failures.push(...result.failures.map((f) => `${panel}: ${f}`));
      }
      return { summary: `${sent} sent`, failures };
    },
  },
  {
    key: "statuses",
    moves: "money",
    async run() {
      let updated = 0;
      const failures: string[] = [];
      for (const { panel, result } of await eachPanel(() => syncOrderStatuses())) {
        updated += result.updated;
        failures.push(...result.failures.map((f) => `${panel}: ${f}`));
      }
      return { summary: `${updated} updated`, failures };
    },
  },
  {
    key: "requests",
    moves: "money",
    async run() {
      const auto = await runAutoDecisions();
      return { summary: `${auto.refills} refills, ${auto.cancels} cancels, ${auto.stuck} stuck`, failures: auto.failures };
    },
  },
  {
    key: "chain",
    moves: "money",
    async run() {
      const chain = await propagateChainStatuses();
      const requests = await propagateRequestDecisions();
      return { summary: `${chain.updated} carried, ${chain.refunded} refunded, ${requests.updated} decisions`, failures: none };
    },
  },
  {
    key: "callbacks",
    moves: "nothing",
    async run() {
      const r = await deliverCallbacks();
      return { summary: `${r.sent} sent, ${r.retrying} retrying, ${r.failed} gave up`, failures: none };
    },
  },
  {
    key: "rent",
    moves: "money",
    async run() {
      const rows = await billPanelRent();
      // Only "charged" moved money; the rest are panels that were free, not
      // due yet, or already suspended.
      const charged = rows.filter((r) => r.result === "charged").length;
      const unpaid = rows.filter((r) => r.result === "unpaid" || r.result === "expired").length;
      return { summary: `${charged} charged, ${unpaid} unpaid, ${rows.length} checked`, failures: none };
    },
  },
  {
    key: "mail",
    moves: "nothing",
    async run() {
      const r = await sendPendingNotificationMails();
      return { summary: `${r.sent} sent`, failures: r.failures };
    },
  },
  {
    key: "rates",
    moves: "money",
    async run() {
      const r = await updateExchangeRates();
      return { summary: "skipped" in r ? String(r.skipped) : `${r.updated ?? 0} updated`, failures: none };
    },
  },
  {
    key: "ranks",
    moves: "nothing",
    async run() {
      const r = await checkDueRanks();
      return { summary: `${r.checked} phrases on ${r.panels} panels`, failures: r.failures };
    },
  },
  {
    key: "catalogue",
    moves: "money",
    async run() {
      const rows = await syncDueProviders();
      const repriced = rows.reduce((n, r) => n + r.repriced, 0);
      return {
        summary: `${rows.length} providers, ${repriced} repriced`,
        failures: rows.filter((r) => r.fault).map((r) => `${r.provider}: ${englishMessage(r.fault!.key, r.fault!.vars)}`),
      };
    },
  },
];

export function cronJob(key: string): CronJob | undefined {
  return CRON_JOBS.find((j) => j.key === key);
}
