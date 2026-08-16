import { roundMoney } from "./money";
import type { Provider } from "@prisma/client";
import { db } from "./db";
import { basePrisma } from "./db-base";
import { nextPublicId } from "./ids";
import { currentPanelId, runAsPanel } from "./tenancy";
import { fetchProviderBalance, fetchProviderServices, providerLabel } from "./providers";
import { notifications, type Alert } from "./notify";
import type { Fault } from "./fault";

/**
 * Keeping the catalogue in step with a provider.
 *
 * A provider raising its price is the one change that silently turns a
 * profitable service into a loss-making one, so the sync does three things
 * rather than one: refresh what the provider says, re-derive the sell price
 * for services that follow it, and report anything an operator would want to
 * have been asked about.
 */

export type SyncReport = {
  provider: string;
  created: number;
  updated: number;
  repriced: number;
  /** How many alternative suppliers changed price, which changes routing. */
  repricedRoutes: number;
  missing: number;
  returned: number;
  /** Changes worth a human look, in the order they were found. Each is the
      event and its values, not a sentence: an admin reads them in whichever
      language they picked. */
  alerts: Alert[];
  /** Why nothing was synced, for the caller to word. */
  fault?: Fault;
};

/**
 * Sell price from cost, for services following their provider.
 *
 * To four places rather than to the base currency's own, because a price is
 * per thousand: a service costing $0.85 per 1,000 is worth less than a cent
 * each, and rounding the per-thousand figure to cents would flatten a whole
 * catalogue onto the same few prices.
 */
function sellPrice(providerRate: number, markupPercent: number): number {
  return roundMoney(providerRate * (1 + markupPercent / 100), 4);
}

function movedTooFar(before: number, after: number, alertPercent: number): boolean {
  if (alertPercent <= 0 || before <= 0) return false;
  return Math.abs(after - before) / before >= alertPercent / 100;
}

/**
 * Reads a provider's catalogue and applies it.
 *
 * `importNew` is off for the scheduled run: a provider adding two thousand
 * services overnight should not quietly become two thousand rows nobody
 * asked for. The manual import in the admin area turns it on.
 */
export async function syncProviderCatalogue(
  provider: Provider,
  { importNew = false }: { importNew?: boolean } = {},
): Promise<SyncReport> {
  const report: SyncReport = {
    provider: providerLabel(provider),
    created: 0,
    updated: 0,
    repriced: 0,
    repricedRoutes: 0,
    missing: 0,
    returned: 0,
    alerts: [],
  };

  const result = await fetchProviderServices(provider);
  if (!result.ok) return { ...report, fault: { key: "adm.providerCallFailed", vars: { detail: result.error } } };
  if (!Array.isArray(result.data)) return { ...report, fault: { key: "adm.providerNoList" } };

  const upstream = new Map<string, Record<string, unknown>>();
  for (const row of result.data.slice(0, 5000)) {
    const id = String((row as { service?: unknown }).service ?? "").trim();
    if (id) upstream.set(id, row as Record<string, unknown>);
  }
  if (upstream.size === 0) {
    // An empty list is far more often a broken key than a provider that has
    // stopped selling, and acting on it would take the whole catalogue down.
    return { ...report, fault: { key: "adm.providerEmptyList" } };
  }

  // Deleted services are left out: repricing one changes nothing anybody can
  // buy, and the "delisted" alerts it raises are a report about a service the
  // operator has already taken off the panel.
  const ours = await db.service.findMany({ where: { providerId: provider.id, deletedAt: null } });

  // Costs move at this provider for every service routed through it, not only
  // the ones that name it as their first choice.
  const routes = await db.serviceRoute.findMany({ where: { providerId: provider.id } });
  for (const route of routes) {
    const row = upstream.get(route.providerServiceId);
    const cost = row ? Number(row.rate) || 0 : 0;
    if (cost > 0 && cost !== route.cost) {
      await db.serviceRoute.update({ where: { id: route.id }, data: { cost } });
      report.repricedRoutes += 1;
    }
  }

  for (const service of ours) {
    const row = upstream.get(service.providerServiceId);

    if (!row) {
      if (!service.missingSince) {
        await db.service.update({
          where: { id: service.id },
          data: { missingSince: new Date(), enabled: false },
        });
        report.missing += 1;
        report.alerts.push({ key: "delisted", id: service.publicId, name: service.name });
      }
      continue;
    }

    const providerRate = Number(row.rate) || 0;
    const min = Math.max(1, Number(row.min) || 1);
    const max = Math.max(min, Number(row.max) || min);

    const data: Record<string, unknown> = {
      providerRate,
      min,
      max,
      refill: Boolean(row.refill),
      cancel: Boolean(row.cancel),
      dripfeed: Boolean(row.dripfeed),
    };

    // Back on the provider's list. The service is not re-enabled on its own:
    // it went off sale while nobody was watching, so a human confirms it.
    if (service.missingSince) {
      data.missingSince = null;
      report.returned += 1;
      report.alerts.push({ key: "relisted", id: service.publicId, name: service.name });
    }

    if (movedTooFar(service.providerRate, providerRate, provider.alertPercent)) {
      report.alerts.push({
        key: providerRate > service.providerRate ? "costMovedUp" : "costMovedDown",
        id: service.publicId,
        name: service.name,
        from: service.providerRate,
        to: providerRate,
      });
    }

    if (service.autoPrice) {
      const rate = sellPrice(providerRate, provider.markupPercent);
      if (rate !== service.rate) {
        data.rate = rate;
        report.repriced += 1;
      }
    } else if (providerRate > service.rate && service.rate > 0) {
      // Hand-priced and now under water. Nothing is changed — the price is
      // the operator's — but it is not left unsaid.
      report.alerts.push({
        key: "underWater",
        id: service.publicId,
        name: service.name,
        rate: service.rate,
        cost: providerRate,
      });
    }

    await db.service.update({ where: { id: service.id }, data });
    report.updated += 1;
  }

  if (importNew) {
    const known = new Set(ours.map((s) => s.providerServiceId));
    const platformSlug = `provider-${provider.id.slice(0, 8)}`;
    const platform = await db.platform.upsert({
      where: { panelId_slug: { panelId: await currentPanelId(), slug: platformSlug } },
      create: { slug: platformSlug, name: providerLabel(provider), icon: "server", visible: false, position: 99 },
      update: {},
    });

    for (const [providerServiceId, row] of upstream) {
      if (known.has(providerServiceId)) continue;

      const providerRate = Number(row.rate) || 0;
      const min = Math.max(1, Number(row.min) || 1);
      const max = Math.max(min, Number(row.max) || min);
      const categoryName = String(row.category ?? "Imported").slice(0, 120);
      const category =
        (await db.category.findFirst({ where: { name: categoryName, platformId: platform.id } })) ??
        (await db.category.create({ data: { name: categoryName, platformId: platform.id, visible: false } }));

      await db.service.create({
        data: {
          publicId: await nextPublicId("service"),
          categoryId: category.id,
          providerId: provider.id,
          providerServiceId,
          name: String(row.name ?? providerServiceId).slice(0, 250),
          rate: sellPrice(providerRate, provider.markupPercent),
          providerRate,
          autoPrice: true,
          min,
          max,
          refill: Boolean(row.refill),
          cancel: Boolean(row.cancel),
          dripfeed: Boolean(row.dripfeed),
          // Nothing goes on sale before an operator has looked at it.
          enabled: false,
        },
      });
      report.created += 1;
    }
  }

  await db.provider.update({ where: { id: provider.id }, data: { lastSyncAt: new Date() } });

  // Funds are read on the same pass: a provider that cannot pay for the next
  // order is the other way the catalogue quietly stops working.
  const balance = await fetchProviderBalance(provider);
  if (balance.ok) {
    const amount = Number(balance.data.balance) || 0;
    await db.provider.update({
      where: { id: provider.id },
      data: { balance: amount, currency: balance.data.currency || provider.currency },
    });
    if (provider.lowBalance > 0 && amount < provider.lowBalance) {
      report.alerts.push({
        key: "lowBalance",
        amount,
        currency: balance.data.currency || provider.currency,
      });
    }
  }

  if (report.alerts.length) await notifyAdmins(providerLabel(provider), report.alerts);
  return report;
}

/**
 * Puts the alerts where an operator will see them. Notifications are per
 * user, so every admin on the panel gets one — a warning delivered to a
 * single account is a warning missed while that person is away.
 */
async function notifyAdmins(providerName: string, alerts: Alert[]): Promise<void> {
  const admins = await db.user.findMany({ where: { role: "admin", banned: false }, select: { id: true } });
  if (admins.length === 0) return;

  // Eight lines is as much as the bell can show; the rest are counted rather
  // than dropped silently.
  const shown: Alert[] = alerts.slice(0, 8);
  if (alerts.length > shown.length) shown.push({ key: "more", count: alerts.length - shown.length });

  await db.notification.createMany({
    data: notifications(admins.map((a) => a.id), {
      // English says "one change" and "two changes"; Vietnamese says neither,
      // so the count picks the sentence instead of being pasted into it.
      key: alerts.length === 1 ? "provider.change" : "provider.changes",
      params: { provider: providerName, count: alerts.length, alerts: shown },
      level: "warning",
      href: "/admin/services",
    }),
  });
}

/**
 * The scheduled pass, across every panel — a cron request has no host to
 * resolve one from. Each provider is only touched once its own interval has
 * elapsed, so a panel can sync hourly while another syncs daily.
 */
export async function syncDueProviders(): Promise<SyncReport[]> {
  const panels = await basePrisma.panel.findMany({ where: { status: "active" }, select: { id: true } });
  const reports: SyncReport[] = [];

  for (const panel of panels) {
    await runAsPanel(panel.id, async () => {
      const providers = await db.provider.findMany({ where: { enabled: true, autoSync: true } });
      for (const provider of providers) {
        const due =
          !provider.lastSyncAt ||
          Date.now() - provider.lastSyncAt.getTime() >= Math.max(1, provider.syncEveryHours) * 3600_000;
        if (!due) continue;
        reports.push(await syncProviderCatalogue(provider));
      }
    });
  }

  return reports;
}
