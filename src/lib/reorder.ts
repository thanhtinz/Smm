import { db } from "@/lib/db";
import { formatLocalDay } from "@/lib/dates";

/**
 * Ordering the same thing again.
 *
 * Customers here buy on a cycle: the same service, for the same channel, every
 * week. The cascade asks them all four questions again each time, which is the
 * right shape for someone browsing and the wrong shape for someone repeating.
 *
 * The repeat is carried in the URL rather than in a table, so it survives a
 * bookmark, a shared link, and a logged-out round trip, and there is nothing
 * to keep in sync when an order is edited. The service travels as its public
 * number — the one the customer already sees — not its cuid.
 */
export type Reorderable = {
  quantity: number;
  link: string;
  comments: string;
  runs: number | null;
  interval: number | null;
  posts: number | null;
  minPerPost: number | null;
  maxPerPost: number | null;
  delay: number | null;
  expiry: Date | null;
  service: { publicId: number };
};

export function reorderHref(order: Reorderable, timeZone: string): string {
  const q = new URLSearchParams({ service: String(order.service.publicId) });

  // A subscription's `link` is the profile being watched, not a URL, and its
  // quantity is a ceiling the form recomputes from posts x maxPerPost — so
  // carrying either across would fill the wrong field with the wrong number.
  if (order.posts !== null) {
    q.set("username", order.link);
    q.set("posts", String(order.posts));
    if (order.minPerPost !== null) q.set("minPerPost", String(order.minPerPost));
    if (order.maxPerPost !== null) q.set("maxPerPost", String(order.maxPerPost));
    if (order.delay !== null) q.set("delay", String(order.delay));
    // The day this falls on where the panel lives. Read in UTC instead, an
    // end date came back one day earlier on every server east of it — and one
    // day earlier again on each reorder after that.
    if (order.expiry) q.set("expiry", formatLocalDay(order.expiry, timeZone));
  } else {
    if (order.link) q.set("link", order.link);
    // Comment services are bought by the line, so the lines are the quantity;
    // sending both would let them disagree.
    if (order.comments) q.set("comments", order.comments);
    else q.set("quantity", String(order.quantity));

    if (order.runs && order.runs > 1) {
      q.set("runs", String(order.runs));
      if (order.interval !== null) q.set("interval", String(order.interval));
    }
  }

  return `/dashboard/new-order?${q.toString()}`;
}

export type FrequentService = {
  id: string;
  publicId: number;
  name: string;
  times: number;
  rate: number;
  platform: { id: string; name: string; icon: string; image: string; color: string } | null;
};

/**
 * What this customer keeps buying, counted from their own orders.
 *
 * No favourites table and nothing for the customer to mark: a service bought
 * four times is a favourite whether or not anyone said so, and a list built
 * from behaviour cannot go stale the way a list built from a one-time click
 * does. Services since disabled drop out on their own — the second query only
 * asks for ones still on sale.
 */
export async function frequentServices(userId: string, take = 4): Promise<FrequentService[]> {
  const grouped = await db.order.groupBy({
    by: ["serviceId"],
    where: { userId },
    _count: { serviceId: true },
    orderBy: { _count: { serviceId: "desc" } },
    // Room to lose a few to disabled services without coming back short.
    take: take * 3,
  });

  // Ordering the same thing twice is a habit; once is just an order, and a
  // "you often buy" list of things bought once reads as noise.
  const repeated = grouped.filter((g) => g._count.serviceId > 1);
  if (repeated.length === 0) return [];

  const services = await db.service.findMany({
    where: { id: { in: repeated.map((g) => g.serviceId) }, enabled: true },
    select: {
      id: true,
      publicId: true,
      name: true,
      rate: true,
      category: {
        select: { platform: { select: { id: true, name: true, icon: true, image: true, color: true } } },
      },
    },
  });

  const byId = new Map(services.map((s) => [s.id, s]));
  return repeated
    .map((g) => {
      const service = byId.get(g.serviceId);
      if (!service) return null;
      return {
        id: service.id,
        publicId: service.publicId,
        name: service.name,
        rate: service.rate,
        times: g._count.serviceId,
        platform: service.category.platform,
      };
    })
    .filter((s): s is FrequentService => s !== null)
    .slice(0, take);
}
