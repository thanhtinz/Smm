import { NextResponse } from "next/server";
import { ON_SALE } from "@/lib/catalogue";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { callerAddress } from "@/lib/auth-throttle";
import { nextPublicId } from "@/lib/ids";
import {
  calculateCharge,
  checkIncrement,
  commentLines,
  orderCost,
  isProfileOrder,
  parseSubscription,
  subscriptionFields,
  type Subscription,
} from "@/lib/orders";
import { priceService, priceServices, resolvePricing } from "@/lib/pricing";
import { can, type AccessRule } from "@/lib/access";
import { CHAIN_UNAVAILABLE, planUpstream, writeUpstream } from "@/lib/chain";
import { guardOrder, duplicateWindow, findDuplicate } from "@/lib/order-guard";
import { apiStatus } from "@/lib/api-status";
import { englishMessage } from "@/lib/fault";
import { openRequest } from "@/lib/requests";
import { LINK_RULES, checkLink, extractUsername, normaliseLink } from "@/lib/links";
import { parseLocalTime } from "@/lib/dates";
import { getBaseCurrency } from "@/lib/currency";
import { logActivity } from "@/lib/auth";
import { getCurrentPanel } from "@/lib/tenancy";
import { STAFF_ROLES } from "@/lib/two-factor";
import { readApiParams } from "@/lib/api-params";

/**
 * Reseller API, shaped to the de-facto SMM panel standard so existing client
 * libraries work unchanged: a single endpoint, form or JSON body, `key` plus
 * `action`, and errors returned as {"error": "..."} with HTTP 200.
 */
export async function POST(request: Request) {
  // The panel first, before anything reads a setting. `getSetting` resolves
  // the current panel to know whose settings to read, and throws "No panel in
  // context" when the host is not one we serve — so asking whether the API is
  // enabled *before* this made the deliberate 404 below unreachable and
  // answered an unknown host with a 500 and a stack trace.
  const panel = await getCurrentPanel();
  if (!panel) return NextResponse.json({ error: "Unknown panel" }, { status: 404 });

  if (!(await getSetting("api.enabled"))) return fail("API is disabled");

  const params = await readApiParams(request);
  const bearer = request.headers.get("authorization");
  const bearerMatch = bearer ? bearer.match(/^\s*Bearer\s+(.+)\s*$/i) : null;
  const key = String(params.key ?? (bearerMatch ? bearerMatch[1] : ""));
  if (!key) return fail("Missing key");

  // A panel that is not trading refuses its API too, or a reseller would keep
  // taking orders it can no longer fulfil.
  if (panel.status !== "active") {
    return fail("This panel is temporarily unavailable");
  }

  // Before the lookup, so an invalid-key flood costs a map read rather than a
  // database query each.
  if (!(await withinUnauthenticatedLimit(await callerAddress()))) return fail("Rate limit exceeded");

  const user = await db.user.findUnique({ where: { apiKey: key } });
  if (!user) return fail("Invalid API key");
  if (user.banned) return fail("Account suspended");

  if (!(await withinRateLimit(user.id))) return fail("Rate limit exceeded");

  // Turning the key off without suspending the account: a reseller whose
  // integration is looping can be stopped here while they keep their panel.
  if (!can(user, "api")) return fail("API access disabled");

  const action = String(params.action ?? "");

  // The same rules the forms enforce, on the door the forms do not use.
  // English, like every other message in this file — these are read by client
  // code, not by a person with a language preference.
  const RULE_FOR: Record<string, AccessRule> = { add: "order", refill: "refill", cancel: "cancel" };
  const rule = RULE_FOR[String(params.action ?? "")];
  if (rule && !can(user, rule)) return fail(englishMessage(`access.denied.${rule}`));

  // Reads stay open while the panel is closed for maintenance, so a reseller
  // can still track orders it has already paid for. Only new business stops.
  if (action === "add" && (await getSetting("maintenance.enabled")) && !STAFF_ROLES.has(user.role)) {
    return fail(String(await getSetting("maintenance.message")));
  }

  switch (action) {
    case "services":
      return services(user);
    case "balance":
      return balance(user.id);
    case "add":
      return add(user, params);
    case "status":
      return status(user.id, params);
    case "orders":
      return statuses(user.id, params);
    case "multi-status":
    case "multi_status":
      return statuses(user.id, params);
    case "refill":
      return raiseRequest(user.id, params, "refill");
    case "cancel":
      return raiseRequest(user.id, params, "cancel");
    case "refill_status":
      return refillStatus(user.id, params);
    default:
      return fail("Invalid action");
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Compatibility: some SMM clients use GET with query parameters.
  // We translate the query string into an application/x-www-form-urlencoded
  // body and run the same handler as POST.
  const body = url.searchParams.toString();

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/x-www-form-urlencoded");

  return POST(new Request(request.url, { method: "POST", headers, body }));
}

/** The names the standard uses for service types in the `services` response. */
const API_TYPE_NAMES: Record<string, string> = {
  default: "Default",
  custom_comments: "Custom Comments",
  subscription: "Subscriptions",
  spread: "Likes spread",
};

/** Only what the priced actions need from the key's owner. */
type ApiCaller = {
  id: string;
  username: string;
  tierId: string | null;
  spent: number;
  discountPercent: number;
};

// ------------------------------------------------------------------ actions

async function services(user: ApiCaller) {
  const rows = await db.service.findMany({
    where: ON_SALE,
    orderBy: { publicId: "asc" },
    include: { category: { select: { name: true } } },
  });

  // Resellers see their own tier's prices, the ones `add` will charge them.
  const rates = await priceServices(await resolvePricing(user), rows);

  return NextResponse.json(
    rows.map((s) => ({
      service: s.publicId,
      name: s.name,
      type: API_TYPE_NAMES[s.type] ?? "Default",
      category: s.category.name,
      // Rates go out as strings: the standard clients parse them that way.
      rate: (rates.get(s.id) ?? s.rate).toFixed(4),
      min: String(s.min),
      max: String(s.max),
      refill: s.refill,
      cancel: s.cancel,
      dripfeed: s.dripfeed,
    }))
  );
}

async function balance(userId: string) {
  const [user, base] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } }),
    getBaseCurrency(),
  ]);
  return NextResponse.json({ balance: user.balance.toFixed(base.decimals), currency: base.code });
}

async function add(user: ApiCaller, params: Record<string, unknown>) {
  const userId = user.id;
  if (!(await getSetting("order.enabled"))) return fail("Ordering is disabled");

  const serviceId = Number(params.service);
  if (!Number.isInteger(serviceId)) return fail("Incorrect service ID");

  const service = await db.service.findFirst({
    where: { publicId: serviceId, ...ON_SALE },
    include: { category: { select: { platform: { select: LINK_RULES } } } },
  });
  if (!service) return fail("Incorrect service ID");

  // A subscription is addressed by username over a run of future posts, so it
  // shares none of the link-and-quantity checks below.
  let subscription: Subscription | null = null;
  let quantity: number;
  let link: string;
  let comments: string[] = [];

  if (isProfileOrder(service.type)) {
    const parsed = parseSubscription(
      {
        username: extractUsername(String(params.username ?? "")),
        posts:
          service.type === "spread"
            ? String(params.old_posts ?? params.posts ?? "")
            : String(params.posts ?? ""),
        min: String(params.min ?? ""),
        max: String(params.max ?? ""),
        delay: String(params.delay ?? "0"),
        expiry: String(params.expiry ?? ""),
      },
      service,
      // A reseller posts an end date as a bare day, and the day it means is
      // the panel's, not whatever zone this process happens to run in.
      String(await getSetting("locale.timezone")) || "UTC",
      // English, like every other answer on this endpoint: a client library
      // reads it, and its wording is part of the contract.
      "en",
    );
    // The standard answers with the name of the offending field, not a
    // sentence, so the first error is reported the way callers expect.
    if ("fieldErrors" in parsed) {
      const field = Object.keys(parsed.fieldErrors)[0];
      return fail(`Incorrect ${field}`);
    }
    subscription = parsed.sub;
    quantity = parsed.quantity;
    link = parsed.sub.username;
  } else {
    link = String(params.link ?? "").trim();
    // The standard sends `comments` instead of `quantity` for comment services,
    // and the count of lines is the quantity.
    comments = commentLines(String(params.comments ?? ""));
    quantity = comments.length > 0 ? comments.length : Number(params.quantity);

    // The reason is spelled out rather than the standard's bare "Incorrect
    // link": a reseller integrating against this needs to know which of the
    // two shapes the service wanted. Still English — a client reads it.
    const wrong = checkLink(link, service.target, service.category.platform);
    if (wrong) return fail(englishMessage(wrong.key, wrong.vars));
    link = normaliseLink(link);
    if (!Number.isInteger(quantity) || quantity <= 0) return fail("Incorrect quantity");
    if (service.type === "custom_comments" && comments.length === 0) return fail("Incorrect comments");
    if (quantity < service.min || quantity > service.max) return fail("Incorrect quantity");
    // English and specific: a client library retrying a rounded-off quantity
    // for ever is what a bare "Incorrect quantity" produces here.
    if (comments.length === 0) {
      const step = checkIncrement(quantity, service);
      if (step) return fail(`Quantity must be a multiple of ${service.increment} (try ${step.suggestion})`);
    }
  }

  const dripfeed = !subscription && (params.runs !== undefined || params.interval !== undefined);
  const runs = Number(params.runs ?? 0);
  const interval = Number(params.interval ?? 0);
  if (dripfeed) {
    if (!service.dripfeed) return fail("Dripfeed is not supported by this service");
    if (!Number.isInteger(runs) || runs < 2) return fail("Incorrect runs");
    if (!Number.isInteger(interval) || interval < 1) return fail("Incorrect interval");
  }

  // Scheduling, which the de-facto standard has no word for. Added because
  // the panel has it and a reseller placing orders through code was the one
  // customer who could not reach it.
  //
  // Two shapes are taken. One carrying a zone — `2026-08-20T14:30:00Z`, or
  // any offset — is an instant and is read as one. One without — the same
  // `2026-08-20 14:30` a person would write — is read in the panel's own
  // timezone, the same rule the order form follows, because a bare wall clock
  // has no other honest reading.
  const startAtRaw = String(params.start_at ?? "").trim();
  let startAt: Date | null = null;
  if (startAtRaw) {
    const maxDays = Number(await getSetting("order.scheduleMaxDays")) || 0;
    if (maxDays <= 0) return fail("Scheduling is disabled");

    const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(startAtRaw);
    if (zoned) {
      const parsed = new Date(startAtRaw);
      startAt = Number.isNaN(parsed.getTime()) ? null : parsed;
    } else {
      const timezone = String(await getSetting("locale.timezone")) || "UTC";
      startAt = parseLocalTime(startAtRaw.replace(" ", "T").slice(0, 16), timezone);
    }

    if (!startAt) return fail("Incorrect start_at");
    if (startAt.getTime() <= Date.now()) return fail("start_at is in the past");
    if (startAt.getTime() > Date.now() + maxDays * 86_400_000) {
      return fail(`start_at cannot be more than ${maxDays} days ahead`);
    }
  }

  const totalQuantity = dripfeed ? quantity * runs : quantity;
  const rate = await priceService(await resolvePricing(user), service);
  const money = (await getBaseCurrency()).decimals;
  const charge = calculateCharge(rate, totalQuantity, money);

  const guarded = await guardOrder(userId, service.id, link, 1, { username: user.username, charge });
  // The API answers in English whatever the account's own language is: these
  // strings are read by a reseller's client code, not by a person.
  if (guarded && "block" in guarded) return fail(englishMessage(guarded.block.key, guarded.block.vars));
  // A held order still gets an id and still answers `status`, which reports
  // it as Pending — a reseller polling has nothing to do differently, and the
  // panel does not owe them the reason it is looking at the order by hand.
  const holdReason = guarded?.hold ?? "";

  const plan = holdReason ? { hops: [] } : await planUpstream(service, totalQuantity);
  if ("error" in plan) {
    await logActivity(userId, "order.chain.blocked", plan.detail);
    return fail(plan.error);
  }

  const [orderPublicId, txPublicId] = await Promise.all([nextPublicId("order"), nextPublicId("transaction")]);

  // Read out here so the transaction below does no settings lookup of its own.
  const dedupe = await duplicateWindow();

  try {
    const order = await db.$transaction(async (tx) => {
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true, spent: true } });
      if (fresh.balance < charge) throw new Error("FUNDS");

      // The same race the form has: a client library retrying is two identical
      // requests in flight at once, and one delivery must not be charged twice.
      if (dedupe && (await findDuplicate(tx, userId, service.id, link, dedupe.since))) {
        throw new Error("DUPLICATE");
      }

      const created = await tx.order.create({
        data: {
          publicId: orderPublicId,
          userId,
          serviceId: service.id,
          link,
          quantity: totalQuantity,
          charge,
          remains: totalQuantity,
          status: holdReason ? "held" : "pending",
          holdReason,
          comments: comments.join("\n"),
          runs: dripfeed ? runs : null,
          interval: dripfeed ? interval : null,
          startAt,
          cost: plan.hops[0]?.charge ?? orderCost(service.providerRate, totalQuantity, money),
          ...subscriptionFields(subscription, service.type === "spread"),
        },
      });

      const balanceAfter = fresh.balance - charge;
      await tx.user.update({ where: { id: userId }, data: { balance: balanceAfter, spent: fresh.spent + charge } });
      await tx.transaction.create({
        data: {
          publicId: txPublicId,
          userId,
          type: "order",
          amount: -charge,
          status: "completed",
          reference: String(orderPublicId),
          note: service.name,
          balanceAfter,
        },
      });

      await writeUpstream(tx, plan.hops, {
        downstreamOrderId: created.id,
        link,
        comments: comments.join("\n"),
        quantity: totalQuantity,
        runs: dripfeed ? runs : null,
        interval: dripfeed ? interval : null,
        subscription,
      });

      return created;
    });

    return NextResponse.json({ order: order.publicId });
  } catch (e) {
    if (e instanceof Error && e.message === "FUNDS") return fail("Not enough funds on balance");
    if (e instanceof Error && e.message === "DUPLICATE") return fail("An identical order was just placed");
    if (e instanceof Error && e.message === "UPSTREAM_FUNDS") {
      await logActivity(userId, "order.chain.funds", service.name);
      return fail(CHAIN_UNAVAILABLE);
    }
    return fail("Order could not be created");
  }
}

async function status(userId: string, params: Record<string, unknown>) {
  if (params.orders !== undefined && String(params.orders ?? "").trim()) {
    return statuses(userId, params);
  }

  const id = Number(params.order);
  if (!Number.isInteger(id)) return fail("Incorrect order ID");

  const order = await db.order.findFirst({ where: { publicId: id, userId } });
  if (!order) return fail("Incorrect order ID");

  const base = await getBaseCurrency();
  return NextResponse.json(orderPayload(order, base.code, base.decimals));
}

/**
 * Refill and cancel, single or in a batch.
 *
 * The standard takes `order` for one and `orders` for many, and answers with
 * an object for one and an array for many — the same shape client libraries
 * already expect from other panels.
 */
async function raiseRequest(userId: string, params: Record<string, unknown>, type: "refill" | "cancel") {
  const single = params.order !== undefined;
  const ids = single
    ? [Number(params.order)]
    : String(params.orders ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .slice(0, 100);

  if (ids.length === 0 || ids.some((n) => !Number.isInteger(n))) return fail("Incorrect order ID");

  const orders = await db.order.findMany({ where: { publicId: { in: ids }, userId }, select: { id: true, publicId: true } });
  const byPublicId = new Map(orders.map((o) => [o.publicId, o.id]));

  const results = [];
  for (const publicId of ids) {
    const orderId = byPublicId.get(publicId);
    if (!orderId) {
      results.push({ order: publicId, error: "Incorrect order ID" });
      continue;
    }
    const outcome = await openRequest(userId, orderId, type);
    results.push(
      "key" in outcome
        // English, like every other message here: a client reads it.
        ? { order: publicId, error: englishMessage(outcome.key, outcome.vars) }
        : { order: publicId, [type]: outcome.publicId },
    );
  }

  if (!single) return NextResponse.json(results);
  const only = results[0];
  return "error" in only ? fail(String(only.error)) : NextResponse.json({ [type]: only[type] });
}

/** Where a refill got to, by the id the refill call handed back. */
async function refillStatus(userId: string, params: Record<string, unknown>) {
  const single = params.refill !== undefined;
  const ids = single
    ? [Number(params.refill)]
    : String(params.refills ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .slice(0, 100);

  if (ids.length === 0 || ids.some((n) => !Number.isInteger(n))) return fail("Incorrect refill ID");

  const rows = await db.orderRequest.findMany({
    where: { publicId: { in: ids }, userId, type: "refill" },
    select: { publicId: true, status: true },
  });
  const found = new Map(rows.map((r) => [r.publicId, r.status]));

  const label = (status: string | undefined) =>
    status === undefined
      ? undefined
      : status === "completed"
        ? "Completed"
        : status === "rejected"
          ? "Rejected"
          : status === "approved"
            ? "In progress"
            : "Pending";

  if (single) {
    const status = label(found.get(ids[0]));
    return status ? NextResponse.json({ status }) : fail("Incorrect refill ID");
  }
  return NextResponse.json(
    ids.map((id) => {
      const status = label(found.get(id));
      return status ? { refill: id, status } : { refill: id, error: "Incorrect refill ID" };
    }),
  );
}

/** Batch status: comma-separated ids, keyed by id in the response. */
async function statuses(userId: string, params: Record<string, unknown>) {
  const ids = String(params.orders ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n))
    .slice(0, 100);

  if (ids.length === 0) return fail("Incorrect order IDs");

  const [orders, base] = await Promise.all([
    db.order.findMany({ where: { publicId: { in: ids }, userId } }),
    getBaseCurrency(),
  ]);

  const found = new Map(orders.map((o) => [o.publicId, o]));
  const out: Record<string, unknown> = {};
  for (const id of ids) {
    const order = found.get(id);
    out[String(id)] = order ? orderPayload(order, base.code, base.decimals) : { error: "Incorrect order ID" };
  }
  return NextResponse.json(out);
}

// ------------------------------------------------------------------ helpers

function orderPayload(
  order: { charge: number; startCount: number; status: string; remains: number },
  currency: string,
  decimals: number
) {
  return {
    charge: order.charge.toFixed(decimals),
    start_count: String(order.startCount),
    status: apiStatus(order.status),
    remains: String(order.remains),
    currency,
  };
}

function fail(message: string) {
  // The standard returns errors with HTTP 200 and an `error` key.
  return NextResponse.json({ error: message });
}

/**
 * A fixed window per bucket, resetting every minute.
 *
 * In this process and no other, which is the right shape for this panel: the
 * database is a SQLite file with one writer, so a deployment is one instance.
 * Run several behind a load balancer and each keeps its own count, and the
 * effective ceiling is the limit times the instances — front it with a proxy
 * limit if you ever do that. Said plainly here rather than implied, because a
 * counter that quietly means something different at scale is worse than one
 * that says what it is.
 *
 * Two things it does have to get right on its own: it must not grow without
 * bound, and it must be reachable before the database is.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Expired buckets, dropped.
 *
 * Entries were only ever overwritten by a later request from the same caller,
 * so a key that called once and never again stayed for the life of the
 * process — one entry per distinct API key that ever touched the panel, for
 * ever. Swept on a size threshold rather than on every call, since the sweep
 * is O(n) and the common case is a map with a handful of live entries.
 */
function sweep(now: number) {
  if (hits.size < 512) return;
  for (const [bucket, entry] of hits) if (now > entry.resetAt) hits.delete(bucket);
}

function withinWindow(bucket: string, limit: number): boolean {
  if (limit <= 0) return true;

  const now = Date.now();
  sweep(now);

  const entry = hits.get(bucket);
  if (!entry || now > entry.resetAt) {
    hits.set(bucket, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

async function withinRateLimit(userId: string): Promise<boolean> {
  return withinWindow(`user:${userId}`, Number(await getSetting("api.rateLimitPerMinute")) || 0);
}

/**
 * The same ceiling, applied to the caller's address before the key is looked
 * up.
 *
 * The limit above only bound callers who had already been authenticated, so a
 * flood of invalid keys ran a database query each and was throttled by
 * nothing at all. Bucketed by address rather than by key, because the key is
 * attacker-chosen and bucketing on it would let one machine mint a fresh
 * bucket per request.
 */
async function withinUnauthenticatedLimit(address: string): Promise<boolean> {
  if (!address) return true;
  const limit = Number(await getSetting("api.rateLimitPerMinute")) || 0;
  // Ten times the per-key allowance: one address may legitimately carry
  // several resellers behind a shared proxy, and this is only meant to stop a
  // machine gun.
  return withinWindow(`ip:${address}`, limit > 0 ? limit * 10 : 0);
}
