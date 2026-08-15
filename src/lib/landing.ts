/**
 * What the landing page needs to know.
 *
 * Gathered in one place because the five layouts want overlapping slices of
 * it and each was otherwise going to query for its own — five variants of the
 * same page should not mean five times the database work.
 */

import { db } from "./db";
import { priceServices, resolveTier } from "./pricing";

export const LANDING_LAYOUTS = ["priceBoard", "orderFirst", "proof", "editorial", "catalogue", "spotlight", "grid", "showcase", "midnight"] as const;
export type LandingLayout = (typeof LANDING_LAYOUTS)[number];

/**
 * The colour mode each landing is drawn for.
 *
 * A landing is a composition, not a skin: its washes, its glow and the
 * contrast between its panels are chosen against one background, and the same
 * page rendered against the other is not the same page. So the choice belongs
 * to whoever picked the layout, and the reader's light/dark switch does not
 * appear on it — a control that changes nothing is worse than no control.
 *
 * Everywhere else in the panel the reader's preference still wins; this is
 * the home page only.
 */
export const LANDING_MODE: Record<LandingLayout, "light" | "dark"> = {
  priceBoard: "light",
  orderFirst: "light",
  proof: "light",
  editorial: "light",
  catalogue: "light",
  spotlight: "light",
  grid: "light",
  showcase: "light",
  midnight: "dark",
};

/** The layout an operator picked, or the first one if the setting is unset. */
export function chosenLayout(settings: Record<string, unknown>): LandingLayout {
  const chosen = String(settings["appearance.landingLayout"] ?? "");
  return (LANDING_LAYOUTS as readonly string[]).includes(chosen)
    ? (chosen as LandingLayout)
    : LANDING_LAYOUTS[0];
}

export type PlatformLine = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  image: string;
  color: string;
  /** Cheapest rate under this platform, priced for whoever is reading. */
  from: number;
  services: number;
  categories: { id: string; name: string; count: number }[];
  /** True when at least one service here can be topped back up after a drop. */
  refill: boolean;
  /** Services here whose page states an average delivery time. */
  timed: number;
};

/** One row the order-first layout's picker can land on. */
export type PickableService = {
  id: string;
  name: string;
  categoryId: string;
  rate: number;
  min: number;
  max: number;
};

export type RecentDelivery = {
  id: string;
  service: string;
  platform: PlatformLine | null;
  quantity: number;
  /** Seconds from placing to settling, or null while it is still running. */
  seconds: number | null;
};

export type Quote = {
  id: string;
  name: string;
  role: string;
  body: string;
  rating: number;
  avatar: string;
};

export type Question = { id: string; question: string; answer: string };

export type LandingData = {
  platforms: PlatformLine[];
  /** Cheapest anywhere, for the one-line price claim. */
  from: number;
  serviceCount: number;
  userCount: number;
  orderCount: number;
  completedCount: number;
  recent: RecentDelivery[];
  /** Every sellable service, priced, for the layout that quotes on the page. */
  picks: PickableService[];
  /** Written by the operator in admin. Empty leaves the section off the page. */
  quotes: Quote[];
  questions: Question[];
  /** Whatever this panel actually accepts, in the operator's own words. */
  payments: { id: string; name: string; icon: string }[];
};

export async function landingData(user: Parameters<typeof resolveTier>[0]): Promise<LandingData> {
  const [platforms, services, userCount, orderCount, completedCount, recentRows, quotes, questions, payments] =
    await Promise.all([
      db.platform.findMany({
        where: { visible: true },
        orderBy: { position: "asc" },
        include: { categories: { orderBy: { position: "asc" }, select: { id: true, name: true } } },
      }),
      db.service.findMany({
        where: { enabled: true },
        orderBy: [{ position: "asc" }, { rate: "asc" }],
        select: {
          id: true,
          name: true,
          rate: true,
          min: true,
          max: true,
          categoryId: true,
          refill: true,
          averageTime: true,
          category: { select: { platformId: true } },
        },
      }),
      db.user.count(),
      db.order.count(),
      db.order.count({ where: { status: "completed" } }),
      // Anonymised on purpose: what a visitor needs is evidence that orders
      // finish, not who placed them.
      db.order.findMany({
        where: { status: "completed" },
        orderBy: { settledAt: "desc" },
        take: 8,
        select: {
          id: true,
          quantity: true,
          createdAt: true,
          settledAt: true,
          service: { select: { name: true, category: { select: { platformId: true } } } },
        },
      }),
      db.testimonial.findMany({ where: { visible: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
      db.faq.findMany({
        where: { visible: true },
        orderBy: [{ position: "asc" }, { question: "asc" }],
        select: { id: true, question: true, answer: true },
      }),
      db.paymentMethod.findMany({
        where: { enabled: true },
        orderBy: { position: "asc" },
        select: { id: true, name: true, icon: true },
      }),
    ]);

  // Priced for the reader's tier, so the landing page and the catalogue agree.
  const rates = await priceServices(await resolveTier(user), services);
  const rateOf = (s: (typeof services)[number]) => rates.get(s.id) ?? s.rate;

  const lines: PlatformLine[] = platforms.map((p) => {
    const mine = services.filter((s) => s.category.platformId === p.id);
    const byCategory = new Map<string, number>();
    for (const s of mine) byCategory.set(s.categoryId, (byCategory.get(s.categoryId) ?? 0) + 1);

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      icon: p.icon,
      image: p.image,
      color: p.color,
      from: mine.length ? Math.min(...mine.map(rateOf)) : 0,
      services: mine.length,
      // Read straight off the services, because a refill guarantee is what
      // this market checks before it looks at the price. averageTime is free
      // text an operator writes ("1-2 giờ"), so it is counted, not compared.
      refill: mine.some((s) => s.refill),
      timed: mine.filter((s) => s.averageTime.trim()).length,
      categories: p.categories
        .map((c) => ({ id: c.id, name: c.name, count: byCategory.get(c.id) ?? 0 }))
        .filter((c) => c.count > 0),
    };
  });

  // A platform with nothing to sell is not worth a row on the price board.
  const selling = lines.filter((l) => l.services > 0);
  const byId = new Map(selling.map((l) => [l.id, l]));

  return {
    platforms: selling,
    from: selling.length ? Math.min(...selling.map((l) => l.from)) : 0,
    serviceCount: services.length,
    userCount,
    orderCount,
    completedCount,
    recent: recentRows.map((o) => ({
      id: o.id,
      service: o.service.name,
      platform: byId.get(o.service.category.platformId ?? "") ?? null,
      quantity: o.quantity,
      seconds: o.settledAt ? Math.round((o.settledAt.getTime() - o.createdAt.getTime()) / 1000) : null,
    })),
    picks: services.map((s) => ({
      id: s.id,
      name: s.name,
      categoryId: s.categoryId,
      rate: rateOf(s),
      min: s.min,
      max: s.max,
    })),
    quotes,
    questions,
    payments,
  };
}
