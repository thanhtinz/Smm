import type { UserTier } from "@prisma/client";
import { db } from "./db";

/**
 * What a customer actually pays.
 *
 * Four layers, most specific first: a price set by hand for this one customer,
 * a price set by hand for their tier, the percentages off the list price, then
 * the list price itself. Every page and every order path resolves through here
 * so a customer is never shown one number and charged another.
 */

export type PricedService = { id: string; rate: number };

/**
 * Who is being priced.
 *
 * This used to be the tier alone, which was enough while a tier was the only
 * thing that moved a price. It no longer is — a customer can carry their own
 * rates and their own discount — and passing the tier around meant every
 * caller would have had to learn about both. The whole answer is resolved
 * once, here, and handed on as one value.
 */
export type Pricing = {
  tier: UserTier | null;
  /** Null for a guest, whose prices nobody has negotiated. */
  userId: string | null;
  /** The customer's own percentage off, on top of the tier's. */
  discountPercent: number;
};

export type PricedUser = {
  id: string;
  tierId: string | null;
  spent: number;
  discountPercent: number;
} | null;

/** A customer with no tier of their own falls to the spend ladder. */
export async function resolvePricing(user: PricedUser): Promise<Pricing> {
  return {
    tier: await resolveTier(user),
    userId: user?.id ?? null,
    discountPercent: user?.discountPercent ?? 0,
  };
}

/** The tier alone, for the pages that name it rather than price with it. */
export async function resolveTier(user: { tierId: string | null; spent: number } | null): Promise<UserTier | null> {
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
 * Prices a batch of services for one customer in a fixed number of queries
 * rather than one per service — the services page lists the whole catalogue.
 */
export async function priceServices<T extends PricedService>(
  pricing: Pricing,
  services: T[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (services.length === 0) return out;

  const ids = services.map((s) => s.id);
  const [tierRows, userRows] = await Promise.all([
    pricing.tier
      ? db.tierPrice.findMany({
          where: { tierId: pricing.tier.id, serviceId: { in: ids } },
          select: { serviceId: true, rate: true },
        })
      : [],
    pricing.userId
      ? db.userServiceRate.findMany({
          where: { userId: pricing.userId, serviceId: { in: ids } },
          select: { serviceId: true, rate: true },
        })
      : [],
  ]);

  const tierRates = new Map(tierRows.map((row) => [row.serviceId, row.rate]));
  const userRates = new Map(userRows.map((row) => [row.serviceId, row.rate]));

  for (const service of services) {
    out.set(
      service.id,
      applyPricing(pricing, service.rate, userRates.get(service.id) ?? tierRates.get(service.id)),
    );
  }
  return out;
}

/** The price of one service for one customer. */
export async function priceService(pricing: Pricing, service: PricedService): Promise<number> {
  const rates = await priceServices(pricing, [service]);
  return rates.get(service.id) ?? service.rate;
}

/**
 * A manual price wins outright — that is the point of setting one. Otherwise
 * the tier percentage comes off the list price and the customer's own
 * percentage comes off what is left. They compound rather than add: two 50%
 * discounts are a quarter of the list price, not free, which is the reading
 * that cannot be made to produce a negative number by stacking. Each is
 * clamped as well, so a mistyped 150% cannot either.
 */
export function applyPricing(pricing: Pricing | null, listRate: number, manualRate?: number): number {
  if (manualRate !== undefined) return Math.max(0, manualRate);
  if (!pricing) return listRate;

  const tierOff = Math.min(100, Math.max(0, pricing.tier?.discountPercent ?? 0)) / 100;
  const userOff = Math.min(100, Math.max(0, pricing.discountPercent)) / 100;
  return Math.max(0, listRate * (1 - tierOff) * (1 - userOff));
}
