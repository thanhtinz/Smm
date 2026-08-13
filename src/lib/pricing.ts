import type { UserTier } from "@prisma/client";
import { db } from "./db";

/**
 * What a customer actually pays.
 *
 * Three layers, most specific first: a price set by hand for their tier, then
 * the tier's percentage off the list price, then the list price itself. Every
 * page and every order path resolves through here so a customer is never shown
 * one number and charged another.
 */

export type PricedService = { id: string; rate: number };

/** A customer with no tier of their own falls to the spend ladder. */
export async function resolveTier(user: {
  tierId: string | null;
  spent: number;
} | null): Promise<UserTier | null> {
  if (!user) return defaultTier();

  if (user.tierId) {
    const assigned = await db.userTier.findUnique({ where: { id: user.tierId } });
    if (assigned) return assigned;
  }

  // The highest rung they have paid their way to, or the starting tier.
  const earned = await db.userTier.findFirst({
    where: { minSpent: { lte: user.spent, gt: 0 } },
    orderBy: { minSpent: "desc" },
  });
  return earned ?? defaultTier();
}

async function defaultTier(): Promise<UserTier | null> {
  return db.userTier.findFirst({ where: { isDefault: true }, orderBy: { position: "asc" } });
}

/**
 * Prices a batch of services for one tier in two queries rather than one per
 * service — the services page lists the whole catalogue.
 */
export async function priceServices<T extends PricedService>(
  tier: UserTier | null,
  services: T[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (services.length === 0) return out;

  const manual = tier
    ? await db.tierPrice.findMany({
        where: { tierId: tier.id, serviceId: { in: services.map((s) => s.id) } },
        select: { serviceId: true, rate: true },
      })
    : [];
  const overrides = new Map(manual.map((row) => [row.serviceId, row.rate]));

  for (const service of services) {
    out.set(service.id, applyTier(tier, service.rate, overrides.get(service.id)));
  }
  return out;
}

/** The price of one service for one tier. */
export async function priceService(tier: UserTier | null, service: PricedService): Promise<number> {
  const rates = await priceServices(tier, [service]);
  return rates.get(service.id) ?? service.rate;
}

/**
 * A manual price wins outright — that is the point of setting one. Otherwise
 * the tier percentage comes off the list price. Discounts are clamped so a
 * mistyped 150% cannot produce a negative price.
 */
export function applyTier(tier: UserTier | null, listRate: number, manualRate?: number): number {
  if (manualRate !== undefined) return Math.max(0, manualRate);
  if (!tier || tier.discountPercent <= 0) return listRate;
  const off = Math.min(100, tier.discountPercent) / 100;
  return Math.max(0, listRate * (1 - off));
}
