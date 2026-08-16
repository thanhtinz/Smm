/**
 * Which provider an order goes to.
 *
 * A service used to name a first choice and a backup, tried in that order
 * whatever they cost. Suppliers do not hold a price still, so a fixed order is
 * a standing instruction to keep paying yesterday's cheapest. These are sorted
 * by what they cost today.
 *
 * Ordering is not the whole of it: a provider that is switched off, or whose
 * balance has run out, will refuse every order sent to it. Trying it first
 * costs a round trip per order and leaves the customer waiting, so it is
 * dropped from the list rather than discovered at the end of it.
 */

import { db } from "./db";
import { providerLabel } from "./providers";

export type Route = {
  providerId: string;
  providerName: string;
  providerServiceId: string;
  cost: number;
  /** Set when the provider's own balance says it cannot take work. */
  skipped?: "disabled" | "empty";
};

type RouteRow = {
  providerId: string;
  providerServiceId: string;
  cost: number;
  enabled: boolean;
  provider: { id: string; name: string; alias: string; enabled: boolean; balance: number; lastSyncAt: Date | null };
};

/**
 * A provider is only judged out of funds once a sync has actually read its
 * balance. Zero on a provider nobody has synced means "not known", and
 * refusing to use it would take a working panel down on a guess.
 */
function outOfFunds(p: RouteRow["provider"]): boolean {
  return p.lastSyncAt !== null && p.balance <= 0;
}

/** Cheapest first; a cost nobody has learned yet sorts last rather than first. */
export function orderRoutes(rows: RouteRow[]): Route[] {
  const usable = rows
    .filter((r) => r.enabled && r.providerServiceId)
    .map((r) => ({
      providerId: r.providerId,
      providerName: providerLabel(r.provider),
      providerServiceId: r.providerServiceId,
      cost: r.cost,
      skipped: !r.provider.enabled ? ("disabled" as const) : outOfFunds(r.provider) ? ("empty" as const) : undefined,
    }));

  return usable.sort((a, b) => {
    if (Boolean(a.skipped) !== Boolean(b.skipped)) return a.skipped ? 1 : -1;
    // A zero cost is "not synced yet", not "free".
    const ac = a.cost > 0 ? a.cost : Number.MAX_SAFE_INTEGER;
    const bc = b.cost > 0 ? b.cost : Number.MAX_SAFE_INTEGER;
    return ac - bc || a.providerName.localeCompare(b.providerName);
  });
}

/**
 * The routes to try for a service, best first.
 *
 * Falls back to the service's own provider and backup when it has no routes
 * at all — a service created by a path that predates this table still has to
 * dispatch.
 */
export async function routesFor(service: {
  id: string;
  providerId: string | null;
  providerServiceId: string;
  providerRate: number;
  backupProviderId: string | null;
  backupProviderServiceId: string;
  provider?: { id: string; name: string; alias: string; enabled: boolean; balance: number; lastSyncAt: Date | null } | null;
  backupProvider?: { id: string; name: string; alias: string; enabled: boolean; balance: number; lastSyncAt: Date | null } | null;
}): Promise<Route[]> {
  const rows = await db.serviceRoute.findMany({
    where: { serviceId: service.id },
    include: {
      provider: { select: { id: true, name: true, alias: true, enabled: true, balance: true, lastSyncAt: true } },
    },
  });

  if (rows.length) return orderRoutes(rows);

  const legacy: RouteRow[] = [];
  if (service.provider && service.providerServiceId) {
    legacy.push({
      providerId: service.provider.id,
      providerServiceId: service.providerServiceId,
      cost: service.providerRate,
      enabled: true,
      provider: service.provider,
    });
  }
  if (service.backupProvider && service.backupProviderServiceId) {
    legacy.push({
      providerId: service.backupProvider.id,
      providerServiceId: service.backupProviderServiceId,
      cost: 0,
      enabled: true,
      provider: service.backupProvider,
    });
  }
  return orderRoutes(legacy);
}

/**
 * Keeps the service's own two fields and its routes saying the same thing.
 * The admin form still edits a first choice and a backup, so saving one has
 * to write the route it means.
 */
export async function syncPrimaryRoutes(
  serviceId: string,
  primary: { providerId: string | null; providerServiceId: string; cost: number },
  backup: { providerId: string | null; providerServiceId: string },
): Promise<void> {
  const keep: string[] = [];

  for (const [provId, servId, cost] of [
    [primary.providerId, primary.providerServiceId, primary.cost],
    [backup.providerId, backup.providerServiceId, 0],
  ] as const) {
    if (!provId || !servId) continue;
    if (keep.includes(provId)) continue;
    keep.push(provId);
    const existing = await db.serviceRoute.findFirst({ where: { serviceId, providerId: provId } });
    if (existing) {
      await db.serviceRoute.update({
        where: { id: existing.id },
        // A cost already learned is not overwritten with the zero that means
        // "unknown", which is what the backup field always carries.
        data: { providerServiceId: servId, ...(cost > 0 ? { cost } : {}) },
      });
    } else {
      await db.serviceRoute.create({
        data: { serviceId, providerId: provId, providerServiceId: servId, cost },
      });
    }
  }
}
