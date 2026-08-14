import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { nextPublicId } from "@/lib/ids";
import {
  calculateCharge,
  commentLines,
  orderCost,
  isValidOrderLink,
  parseSubscription,
  subscriptionFields,
  type Subscription,
} from "@/lib/orders";
import { priceService, priceServices, resolveTier } from "@/lib/pricing";
import { CHAIN_UNAVAILABLE, planUpstream, writeUpstream } from "@/lib/chain";
import { guardOrder } from "@/lib/order-guard";
import { englishMessage } from "@/lib/notify";
import { getBaseCurrency } from "@/lib/currency";
import { logActivity } from "@/lib/auth";
import { getCurrentPanel } from "@/lib/tenancy";
import { STAFF_ROLES } from "@/lib/two-factor";

/**
 * Reseller API, shaped to the de-facto SMM panel standard so existing client
 * libraries work unchanged: a single endpoint, form or JSON body, `key` plus
 * `action`, and errors returned as {"error": "..."} with HTTP 200.
 */
export async function POST(request: Request) {
  if (!(await getSetting("api.enabled"))) return fail("API is disabled");

  const params = await readParams(request);
  const key = String(params.key ?? "");
  if (!key) return fail("Missing key");

  // A panel that is not trading refuses its API too, or a reseller would keep
  // taking orders it can no longer fulfil.
  const panel = await getCurrentPanel();
  if (!panel) return NextResponse.json({ error: "Unknown panel" }, { status: 404 });
  if (panel.status !== "active") {
    return NextResponse.json({ error: "This panel is temporarily unavailable" }, { status: 503 });
  }

  const user = await db.user.findUnique({ where: { apiKey: key } });
  if (!user) return fail("Invalid API key");
  if (user.banned) return fail("Account suspended");

  if (!(await withinRateLimit(user.id))) return fail("Rate limit exceeded");

  const action = String(params.action ?? "");

  // Reads stay open while the panel is closed for maintenance, so a reseller
  // can still track orders it has already paid for. Only new business stops.
  if (action === "add" && (await getSetting("maintenance.enabled")) && !STAFF_ROLES.has(user.role)) {
    return NextResponse.json({ error: String(await getSetting("maintenance.message")) }, { status: 503 });
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
    default:
      return fail("Invalid action");
  }
}

export async function GET() {
  return fail("Use POST");
}

/** The names the standard uses for service types in the `services` response. */
const API_TYPE_NAMES: Record<string, string> = {
  default: "Default",
  custom_comments: "Custom Comments",
  subscription: "Subscriptions",
};

/** Only what the priced actions need from the key's owner. */
type ApiCaller = { id: string; tierId: string | null; spent: number };

// ------------------------------------------------------------------ actions

async function services(user: ApiCaller) {
  const rows = await db.service.findMany({
    where: { enabled: true },
    orderBy: { publicId: "asc" },
    include: { category: { select: { name: true } } },
  });

  // Resellers see their own tier's prices, the ones `add` will charge them.
  const rates = await priceServices(await resolveTier(user), rows);

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

  const service = await db.service.findFirst({ where: { publicId: serviceId, enabled: true } });
  if (!service) return fail("Incorrect service ID");

  // A subscription is addressed by username over a run of future posts, so it
  // shares none of the link-and-quantity checks below.
  let subscription: Subscription | null = null;
  let quantity: number;
  let link: string;
  let comments: string[] = [];

  if (service.type === "subscription") {
    const parsed = parseSubscription(
      {
        username: String(params.username ?? ""),
        posts: String(params.posts ?? ""),
        min: String(params.min ?? ""),
        max: String(params.max ?? ""),
        delay: String(params.delay ?? "0"),
        expiry: String(params.expiry ?? ""),
      },
      service,
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

    if (!link || !isValidOrderLink(link)) return fail("Incorrect link");
    if (!Number.isInteger(quantity) || quantity <= 0) return fail("Incorrect quantity");
    if (service.type === "custom_comments" && comments.length === 0) return fail("Incorrect comments");
    if (quantity < service.min || quantity > service.max) return fail("Incorrect quantity");
  }

  const dripfeed = !subscription && (params.runs !== undefined || params.interval !== undefined);
  const runs = Number(params.runs ?? 0);
  const interval = Number(params.interval ?? 0);
  if (dripfeed) {
    if (!service.dripfeed) return fail("Dripfeed is not supported by this service");
    if (!Number.isInteger(runs) || runs < 2) return fail("Incorrect runs");
    if (!Number.isInteger(interval) || interval < 1) return fail("Incorrect interval");
  }

  const guarded = await guardOrder(userId, service.id, link);
  // The API answers in English whatever the account's own language is: these
  // strings are read by a reseller's client code, not by a person.
  if (guarded) return fail(englishMessage(guarded.key, guarded.vars));

  const totalQuantity = dripfeed ? quantity * runs : quantity;
  const rate = await priceService(await resolveTier(user), service);
  const charge = calculateCharge(rate, totalQuantity);

  const plan = await planUpstream(service, totalQuantity);
  if ("error" in plan) {
    await logActivity(userId, "order.chain.blocked", plan.detail);
    return fail(plan.error);
  }

  const [orderPublicId, txPublicId] = await Promise.all([nextPublicId("order"), nextPublicId("transaction")]);

  try {
    const order = await db.$transaction(async (tx) => {
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true, spent: true } });
      if (fresh.balance < charge) throw new Error("FUNDS");

      const created = await tx.order.create({
        data: {
          publicId: orderPublicId,
          userId,
          serviceId: service.id,
          link,
          quantity: totalQuantity,
          charge,
          remains: totalQuantity,
          status: "pending",
          comments: comments.join("\n"),
          runs: dripfeed ? runs : null,
          interval: dripfeed ? interval : null,
          cost: plan.hops[0]?.charge ?? orderCost(service.providerRate, totalQuantity),
          ...subscriptionFields(subscription),
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
    if (e instanceof Error && e.message === "UPSTREAM_FUNDS") {
      await logActivity(userId, "order.chain.funds", service.name);
      return fail(CHAIN_UNAVAILABLE);
    }
    return fail("Order could not be created");
  }
}

async function status(userId: string, params: Record<string, unknown>) {
  const id = Number(params.order);
  if (!Number.isInteger(id)) return fail("Incorrect order ID");

  const order = await db.order.findFirst({ where: { publicId: id, userId } });
  if (!order) return fail("Incorrect order ID");

  const base = await getBaseCurrency();
  return NextResponse.json(orderPayload(order, base.code, base.decimals));
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
    status: STATUS_LABEL[order.status] ?? order.status,
    remains: String(order.remains),
    currency,
  };
}

/** The standard uses title-case status names. */
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  inprogress: "In progress",
  completed: "Completed",
  partial: "Partial",
  canceled: "Canceled",
  refunded: "Refunded",
};

function fail(message: string) {
  // The standard returns errors with HTTP 200 and an `error` key.
  return NextResponse.json({ error: message });
}

/** Accepts both form-encoded and JSON bodies, as clients differ. */
async function readParams(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) return (await request.json()) as Record<string, unknown>;
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  } catch {
    return {};
  }
}

// A fixed window per key is enough to stop a runaway loop without adding
// infrastructure; it resets every minute.
const hits = new Map<string, { count: number; resetAt: number }>();

async function withinRateLimit(userId: string): Promise<boolean> {
  const limit = Number(await getSetting("api.rateLimitPerMinute")) || 0;
  if (limit <= 0) return true;

  const now = Date.now();
  const entry = hits.get(userId);
  if (!entry || now > entry.resetAt) {
    hits.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
