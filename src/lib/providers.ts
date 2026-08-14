import { db } from "@/lib/db";
import { nextPublicId } from "@/lib/ids";
import { notification } from "./notify";
import { routesFor } from "./routing";
import { withSettled } from "./orders";

/**
 * Client for upstream panels. They speak the same standard this panel exposes
 * at /api/v2 — one POST endpoint with `key` and `action` — so a provider can
 * itself be another panel built from this codebase.
 */

export type ProviderService = {
  service: string;
  name: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  refill?: boolean;
  cancel?: boolean;
  dripfeed?: boolean;
  type?: string;
};

export type ProviderStatus = {
  charge?: string;
  start_count?: string;
  status?: string;
  remains?: string;
  error?: string;
};

const TIMEOUT_MS = 20_000;

async function call<T>(
  provider: { apiUrl: string; apiKey: string },
  params: Record<string, string | number>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const body = new URLSearchParams({ key: provider.apiKey });
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(provider.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `Provider returned HTTP ${res.status}` };

    const data = (await res.json()) as T & { error?: string };
    // The standard reports failures with HTTP 200 and an `error` key.
    if (data && typeof data === "object" && !Array.isArray(data) && data.error) {
      return { ok: false, error: String(data.error) };
    }
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return { ok: false, error: "Provider timed out" };
    return { ok: false, error: "Provider could not be reached" };
  } finally {
    clearTimeout(timer);
  }
}

export function fetchProviderServices(provider: { apiUrl: string; apiKey: string }) {
  return call<ProviderService[]>(provider, { action: "services" });
}

export function fetchProviderBalance(provider: { apiUrl: string; apiKey: string }) {
  return call<{ balance: string; currency: string }>(provider, { action: "balance" });
}

/**
 * Refill and cancel, the two request actions in the standard.
 *
 * Providers differ on the reply shape — some return `{refill: id}`, some a
 * bare id, some `{cancel: [...]}` — so the id is read loosely and only used as
 * a reference to show an operator.
 */
export async function requestProviderRefill(
  provider: { apiUrl: string; apiKey: string },
  providerOrderId: string,
) {
  const result = await call<{ refill?: string | number } | string | number>(provider, {
    action: "refill",
    order: providerOrderId,
  });
  if (!result.ok) return result;
  return { ok: true as const, data: String((result.data as { refill?: string | number })?.refill ?? result.data ?? "") };
}

export async function requestProviderCancel(
  provider: { apiUrl: string; apiKey: string },
  providerOrderId: string,
) {
  const result = await call<unknown>(provider, { action: "cancel", orders: providerOrderId });
  if (!result.ok) return result;

  // `cancel` answers with an array, one entry per order asked about.
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  const error = (row as { cancel?: { error?: string } } | undefined)?.cancel;
  if (error && typeof error === "object" && "error" in error && error.error) {
    return { ok: false as const, error: String(error.error) };
  }
  return { ok: true as const, data: String((row as { cancel?: unknown })?.cancel ?? "") };
}

/** The dd/mm/yyyy an expiry is sent as. */
function formatExpiry(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function placeProviderOrder(
  provider: { apiUrl: string; apiKey: string },
  order: {
    service: string;
    link: string;
    quantity: number;
    comments?: string;
    runs?: number | null;
    interval?: number | null;
    posts?: number | null;
    minPerPost?: number | null;
    maxPerPost?: number | null;
    delay?: number | null;
    expiry?: Date | null;
  }
) {
  // A subscription is addressed by username and described by its per-post
  // range, so it sends none of the link-and-quantity fields.
  if (order.posts) {
    const params: Record<string, string | number> = {
      action: "add",
      service: order.service,
      username: order.link,
      posts: order.posts,
      min: order.minPerPost ?? 0,
      max: order.maxPerPost ?? 0,
      delay: order.delay ?? 0,
    };
    if (order.expiry) params.expiry = formatExpiry(order.expiry);
    return call<{ order: number | string }>(provider, params);
  }

  const params: Record<string, string | number> = {
    action: "add",
    service: order.service,
    link: order.link,
    quantity: order.quantity,
  };
  // The standard sends the comments instead of a quantity for these; keeping
  // both is harmless and providers that ignore one still get the other.
  if (order.comments) params.comments = order.comments;
  if (order.runs && order.interval) {
    params.runs = order.runs;
    params.interval = order.interval;
  }
  return call<{ order: number | string }>(provider, params);
}

export function fetchProviderStatuses(provider: { apiUrl: string; apiKey: string }, ids: string[]) {
  return call<Record<string, ProviderStatus>>(provider, { action: "orders", orders: ids.join(",") });
}

/** Upstream status names vary in case and spacing; normalise to our own. */
export function normaliseStatus(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s_-]/g, "");
  const map: Record<string, string> = {
    pending: "pending",
    inprogress: "inprogress",
    processing: "processing",
    completed: "completed",
    complete: "completed",
    partial: "partial",
    canceled: "canceled",
    cancelled: "canceled",
    refunded: "refunded",
    error: "canceled",
    fail: "canceled",
    failed: "canceled",
  };
  return map[key] ?? null;
}

/**
 * Pushes queued orders upstream. Only orders whose service is mapped to an
 * enabled provider are touched; everything else stays for manual handling.
 */
export async function dispatchPendingOrders(limit = 25) {
  const orders = await db.order.findMany({
    where: {
      status: "pending",
      providerOrderId: "",
      // A service supplied only through routes has no provider of its own,
      // and would otherwise never be picked up.
      service: { OR: [{ providerId: { not: null } }, { routes: { some: { enabled: true } } }] },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { service: { include: { provider: true, backupProvider: true } } },
  });

  // Read once rather than per order: a batch of 25 tends to share providers.
  const providersById = new Map(
    (await db.provider.findMany()).map((p) => [p.id, p] as const),
  );

  let sent = 0;
  const failures: string[] = [];

  for (const order of orders) {
    // Cheapest first, and a provider that is off or out of funds is dropped
    // rather than tried: it would refuse, and the customer would wait for the
    // round trip to find that out.
    const routes = (await routesFor(order.service)).filter((r) => !r.skipped);

    if (routes.length === 0) continue;

    const refusals: string[] = [];
    let placed = false;
    const first = routes[0];

    for (const route of routes) {
      const provider = providersById.get(route.providerId);
      if (!provider) continue;
      const result = await placeProviderOrder(provider, {
        service: route.providerServiceId,
        link: order.link,
        quantity: order.quantity,
        comments: order.comments,
        runs: order.runs,
        interval: order.interval,
        posts: order.posts,
        minPerPost: order.minPerPost,
        maxPerPost: order.maxPerPost,
        delay: order.delay,
        expiry: order.expiry,
      });

      if (!result.ok) {
        refusals.push(`${route.providerName}: ${result.error}`);
        continue;
      }

      await db.order.update({
        where: { id: order.id },
        data: {
          providerOrderId: String(result.data.order),
          // Remembered so status, refill and cancel go back to whoever took
          // it, not to whichever provider is cheapest later.
          providerId: route.providerId,
          status: "processing",
          // Silent when it went to the cheapest route, which is the norm.
          note: route === first ? "" : `Sent to ${route.providerName} after ${first.providerName} refused`,
        },
      });
      sent += 1;
      placed = true;
      break;
    }

    if (!placed) {
      const reason = refusals.join(" | ");
      failures.push(`#${order.publicId}: ${reason}`);
      // Recorded on the order so an operator can see why it is still queued.
      await db.order.update({ where: { id: order.id }, data: { note: reason } });
    }
  }

  return { sent, failures };
}

/** Pulls status for orders already sent upstream. */
export async function syncOrderStatuses(limit = 100) {
  const orders = await db.order.findMany({
    where: {
      providerOrderId: { not: "" },
      status: { in: ["pending", "processing", "inprogress"] },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    include: { provider: true, service: { include: { provider: true } } },
  });

  // One request per provider rather than per order, keyed by whoever took the
  // order. Orders placed before that was recorded fall back to the service.
  const byProvider = new Map<string, typeof orders>();
  for (const order of orders) {
    const provider = order.provider ?? order.service.provider;
    if (!provider?.enabled) continue;
    byProvider.set(provider.id, [...(byProvider.get(provider.id) ?? []), order]);
  }

  let updated = 0;
  const failures: string[] = [];

  for (const group of byProvider.values()) {
    const provider = (group[0].provider ?? group[0].service.provider)!;
    const result = await fetchProviderStatuses(
      provider,
      group.map((o) => o.providerOrderId)
    );
    if (!result.ok) {
      failures.push(`${provider.name}: ${result.error}`);
      continue;
    }

    for (const order of group) {
      const row = result.data[order.providerOrderId];
      if (!row || row.error) continue;

      const status = normaliseStatus(row.status);
      const remains = Number(row.remains);
      const startCount = Number(row.start_count);

      const data: Record<string, unknown> = {};
      if (status && status !== order.status) data.status = status;
      if (Number.isFinite(remains) && remains !== order.remains) data.remains = remains;
      if (Number.isFinite(startCount) && startCount !== order.startCount) data.startCount = startCount;
      if (Object.keys(data).length === 0) continue;

      // Upstream deciding an order is dead has to give the customer their
      // money back; a partial delivery refunds only the undelivered share.
      const refundable =
        status === "canceled" || status === "refunded"
          ? order.charge
          : status === "partial" && Number.isFinite(remains) && remains > 0
            ? Math.round((order.charge * Math.min(remains, order.quantity)) / order.quantity)
            : 0;

      if (refundable > 0) {
        await settleRefund(order.id, order.userId, refundable, order.publicId, withSettled(data));
      } else {
        await db.order.update({ where: { id: order.id }, data: withSettled(data) });
      }
      updated += 1;
    }
  }

  return { updated, failures };
}

/**
 * Applies a status change and returns money in one transaction.
 *
 * Idempotent through the existing refund row: a repeated sync, or a status
 * that arrives twice, cannot pay the customer twice. `reference` is the
 * order's public id, which repeats across panels but not within one, and
 * Transaction is panel-scoped — so the lookup is unambiguous.
 */
export async function settleRefund(
  orderId: string,
  userId: string,
  amount: number,
  orderPublicId: number,
  data: Record<string, unknown>,
  note?: string,
) {
  const txPublicId = await nextPublicId("transaction");

  await db.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: { userId, type: "refund", reference: String(orderPublicId) },
      select: { id: true },
    });
    await tx.order.update({ where: { id: orderId }, data });
    if (existing) return;

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true, spent: true } });
    const balanceAfter = user.balance + amount;

    await tx.user.update({
      where: { id: userId },
      data: { balance: balanceAfter, spent: Math.max(0, user.spent - amount) },
    });
    await tx.transaction.create({
      data: {
        publicId: txPublicId,
        userId,
        type: "refund",
        amount,
        status: "completed",
        reference: String(orderPublicId),
        note: note ?? `Provider refund for order #${orderPublicId}`,
        balanceAfter,
      },
    });
    await tx.notification.create({
      data: notification({
        userId,
        key: "order.partial",
        params: { id: orderPublicId },
        level: "warning",
        href: "/dashboard/orders",
      }),
    });
  });
}
