"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { nextPublicId } from "@/lib/ids";
import {
  calculateCharge,
  commentLines,
  orderCost,
  parseSubscription,
  subscriptionFields,
  type Subscription,
} from "@/lib/orders";
import { priceService, priceServices, resolveTier } from "@/lib/pricing";
import { CHAIN_UNAVAILABLE, planUpstream, writeUpstream, type ChainHop } from "@/lib/chain";
import { duplicateOrder, duplicateWindow, findDuplicate, guardOrder, orderRateLimit } from "@/lib/order-guard";
import { maintenanceState } from "@/lib/maintenance";
import { readerMessages } from "@/lib/context";
import { LINK_RULES, checkLink, extractUsername, normaliseLink } from "@/lib/links";

/** As many as one paste is allowed to place at once. */
const MAX_LINES = 100;

export type OrderState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: { orderId: number; charge: number };
};

export async function placeOrderAction(_prev: OrderState, formData: FormData): Promise<OrderState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.session") };

  if (!(await getSetting("order.enabled"))) {
    return { error: t("err.orderDisabled") };
  }

  // The layout already shows the notice; this is what stops a form posted
  // from a page that was open before the panel closed.
  const closed = await maintenanceState();
  if (closed.on) return { error: closed.message };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { fieldErrors: { serviceId: t("err.chooseService") } };

  // Read first: the service type decides what the rest of the form means.
  const service = await db.service.findFirst({
    where: { id: serviceId, enabled: true },
    include: { category: { select: { platform: { select: LINK_RULES } } } },
  });
  if (!service) return { fieldErrors: { serviceId: t("err.serviceGone") } };
  const rules = service.category.platform;

  // A subscription watches a profile instead of pointing at one post, so it
  // takes a username and a run of future posts rather than a link and a count.
  let subscription: Subscription | null = null;
  let quantity: number;
  let link: string;
  let comments: string[] = [];

  if (service.type === "subscription") {
    const parsed = parseSubscription(
      {
        // A customer given a username box pastes a profile link into it about
        // as often as the reverse, so either is accepted.
        username: extractUsername(String(formData.get("username") ?? "")),
        posts: String(formData.get("posts") ?? ""),
        min: String(formData.get("minPerPost") ?? ""),
        max: String(formData.get("maxPerPost") ?? ""),
        delay: String(formData.get("delay") ?? "0"),
        expiry: String(formData.get("expiry") ?? ""),
      },
      service,
    );
    if ("fieldErrors" in parsed) return parsed;
    subscription = parsed.sub;
    quantity = parsed.quantity;
    link = parsed.sub.username;
  } else {
    link = String(formData.get("link") ?? "").trim();
    const quantityRaw = String(formData.get("quantity") ?? "").trim();

    // A comment service is bought by the comment, so the lines the customer
    // wrote are the quantity. Parsed before validation, since everything below
    // then treats both kinds the same.
    comments = commentLines(String(formData.get("comments") ?? ""));

    const fieldErrors: Record<string, string> = {};
    if (!link) {
      fieldErrors.link = t("err.linkRequired");
    } else {
      // Checked against the platform's own shape, so a profile pasted into a
      // likes service is refused here rather than by the provider later.
      const wrong = checkLink(link, service.target, rules);
      if (wrong) fieldErrors.link = t(wrong.key, wrong.vars);
      else link = normaliseLink(link);
    }

    quantity = comments.length > 0 ? comments.length : Number(quantityRaw);
    if (comments.length === 0) {
      if (!quantityRaw) fieldErrors.quantity = t("err.quantityRequired");
      else if (!Number.isInteger(quantity) || quantity <= 0) fieldErrors.quantity = t("err.quantityWhole");
    }
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    if (service.type === "custom_comments" && comments.length === 0) {
      return { fieldErrors: { comments: t("err.commentsEmpty") } };
    }
    if (quantity < service.min || quantity > service.max) {
      return {
        fieldErrors: {
          quantity: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}`,
        },
      };
    }
  }

  // Drip-feed splits one order into `runs` deliveries spaced `interval`
  // minutes apart, so the charge is quantity × runs. A subscription already
  // spreads itself over future posts, so the two do not combine.
  const dripfeed = formData.get("dripfeed") === "on" && !subscription;
  const runs = dripfeed ? Number(formData.get("runs") ?? 0) : 0;
  const interval = dripfeed ? Number(formData.get("interval") ?? 0) : 0;
  if (dripfeed) {
    const fieldErrors: Record<string, string> = {};
    if (!Number.isInteger(runs) || runs < 2) fieldErrors.runs = t("err.runsMin");
    if (!Number.isInteger(interval) || interval < 1) fieldErrors.interval = t("err.intervalMin");
    if (!service.dripfeed) fieldErrors.dripfeed = t("err.noDripfeed");
    if (Object.keys(fieldErrors).length) return { fieldErrors };
  }

  const totalQuantity = dripfeed ? quantity * runs : quantity;
  // The tier price, not the list price — the same number the order form showed.
  const rate = await priceService(await resolveTier(user), service);
  const charge = calculateCharge(rate, totalQuantity);
  const minCharge = Number(await getSetting("order.minCharge")) || 0;
  if (charge < minCharge) {
    return { fieldErrors: { quantity: t("err.minCharge", { amount: minCharge.toLocaleString() }) } };
  }

  // After the shape of the order is known, so the message names the service
  // the customer actually chose and the ceiling weighs the real charge.
  const guarded = await guardOrder(user.id, service.id, link, 1, { username: user.username, charge });
  if (guarded && "block" in guarded) return { error: t(guarded.block.key, guarded.block.vars) };
  const holdReason = guarded?.hold ?? "";

  // On a child panel the same order has to be bought from the panel above —
  // but not while it is held. Nothing is spent upstream until a human has
  // said the order is real; approving it buys the chain then.
  const plan = holdReason ? { hops: [] } : await planUpstream(service, totalQuantity);
  if ("error" in plan) {
    await logActivity(user.id, "order.chain.blocked", plan.detail);
    return { error: plan.error };
  }

  // The counter table lives on its own connection, so ids are allocated before
  // the transaction opens — writing to it mid-transaction risks SQLITE_BUSY.
  const [orderPublicId, txPublicId] = await Promise.all([nextPublicId("order"), nextPublicId("transaction")]);

  // Read out here so the transaction below does no settings lookup of its own.
  const dedupe = await duplicateWindow();

  // Re-read the balance inside the transaction so two concurrent submissions
  // cannot both pass the check and overdraw the account.
  try {
    const result = await db.$transaction(async (tx) => {
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balance: true, spent: true } });
      if (fresh.balance < charge) throw new Error("INSUFFICIENT_FUNDS");

      // Asked again in here, because the check before pricing loses the race
      // it exists to win: two submissions milliseconds apart both read "no
      // duplicate" and the customer pays twice for one delivery.
      if (dedupe && (await findDuplicate(tx, user.id, service.id, link, dedupe.since))) {
        throw new Error("DUPLICATE");
      }

      const order = await tx.order.create({
        data: {
          publicId: orderPublicId,
          userId: user.id,
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
          // On a child panel the cost is what the panel above charges, which
          // the first hop already worked out.
          cost: plan.hops[0]?.charge ?? orderCost(service.providerRate, totalQuantity),
          ...subscriptionFields(subscription),
        },
      });

      const balanceAfter = fresh.balance - charge;
      await tx.user.update({
        where: { id: user.id },
        data: { balance: balanceAfter, spent: fresh.spent + charge },
      });

      await tx.transaction.create({
        data: {
          publicId: txPublicId,
          userId: user.id,
          type: "order",
          amount: -charge,
          currency: "base",
          status: "completed",
          reference: String(orderPublicId),
          note: service.name,
          balanceAfter,
        },
      });

      await writeUpstream(tx, plan.hops, {
        downstreamOrderId: order.id,
        link,
        comments: comments.join("\n"),
        quantity: totalQuantity,
        runs: dripfeed ? runs : null,
        interval: dripfeed ? interval : null,
        subscription,
      });

      return order;
    });

    await logActivity(
      user.id,
      "order.create",
      `#${result.publicId} ${service.name} x${quantity}${plan.hops.length ? ` +${plan.hops.length} upstream` : ""}`,
    );
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");

    return { success: { orderId: result.publicId, charge } };
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_FUNDS") {
      return { error: t("err.balanceOrder") };
    }
    // The losing half of a double-click. Nothing was charged, and the order
    // the other half placed is already on its way.
    if (e instanceof Error && e.message === "DUPLICATE") {
      return { error: t("err.duplicateRace") };
    }
    if (e instanceof Error && e.message === "UPSTREAM_FUNDS") {
      // The customer is not the one short of money, and should not be told
      // which panel above is. Nothing was charged — the transaction rolled back.
      await logActivity(user.id, "order.chain.funds", `${service.name} x${quantity}`);
      return { error: CHAIN_UNAVAILABLE };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Mass order
// ---------------------------------------------------------------------------

export type MassOrderState = {
  error?: string;
  /** One entry per input line, in order, so the user can see what failed. */
  results?: { line: number; raw: string; ok: boolean; message: string }[];
  placed?: number;
  totalCharge?: number;
};

/**
 * Accepts the format every SMM panel uses:  service_id | link | quantity
 * One order per line. Lines are validated first and only affordable, valid
 * lines are placed — a bad line never blocks the rest.
 */
export async function massOrderAction(_prev: MassOrderState, formData: FormData): Promise<MassOrderState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.session") };
  if (!(await getSetting("order.enabled"))) return { error: t("err.orderDisabled") };

  const closed = await maintenanceState();
  if (closed.on) return { error: closed.message };

  const lines = String(formData.get("bulk") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { error: t("err.linesEmpty") };
  if (lines.length > MAX_LINES) return { error: t("err.linesMax", { max: MAX_LINES }) };

  const services = await db.service.findMany({
    where: { enabled: true },
    include: { category: { select: { platform: { select: LINK_RULES } } } },
  });
  const byPublicId = new Map(services.map((s) => [String(s.publicId), s]));

  const rates = await priceServices(await resolveTier(user), services);
  const rateOf = (id: string, fallback: number) => rates.get(id) ?? fallback;

  type Parsed = { line: number; raw: string; service: (typeof services)[number]; link: string; quantity: number; charge: number };
  const parsed: Parsed[] = [];
  const results: NonNullable<MassOrderState["results"]> = [];

  lines.forEach((raw, i) => {
    const line = i + 1;
    const parts = raw.split("|").map((p) => p.trim());
    if (parts.length !== 3) {
      results.push({ line, raw, ok: false, message: t("err.massFormat") });
      return;
    }
    const [idPart, link, qtyPart] = parts;
    const service = byPublicId.get(idPart);
    if (!service) {
      results.push({ line, raw, ok: false, message: t("err.massUnknownService", { id: idPart }) });
      return;
    }
    const wrong = checkLink(link, service.target, service.category.platform);
    if (wrong) {
      // The reason, not just "invalid": on a hundred-line paste the customer
      // needs to know which lines to fix and how.
      results.push({ line, raw, ok: false, message: t(wrong.key, wrong.vars) });
      return;
    }
    // A comment service is bought by the comment, and a line of this form has
    // nowhere to put them, so it cannot be ordered here.
    if (service.type === "custom_comments") {
      results.push({ line, raw, ok: false, message: t("err.massComments", { id: idPart }) });
      return;
    }
    if (service.type === "subscription") {
      results.push({ line, raw, ok: false, message: t("err.massSubscription", { id: idPart }) });
      return;
    }
    const quantity = Number(qtyPart);
    if (!Number.isInteger(quantity) || quantity < service.min || quantity > service.max) {
      results.push({
        line,
        raw,
        ok: false,
        message: t("err.massQuantity", { min: service.min.toLocaleString(), max: service.max.toLocaleString() }),
      });
      return;
    }
    parsed.push({ line, raw, service, link, quantity, charge: calculateCharge(rateOf(service.id, service.rate), quantity) });
  });

  const throttled = await orderRateLimit(user.id, parsed.length);
  if (throttled) return { error: t(throttled.key, throttled.vars) };

  for (const p of [...parsed]) {
    const clash = await duplicateOrder(user.id, p.service.id, p.link);
    if (!clash) continue;
    results.push({ line: p.line, raw: p.raw, ok: false, message: t(clash.key, clash.vars) });
    parsed.splice(parsed.indexOf(p), 1);
  }
  if (parsed.length === 0) return { results: results.sort((a, b) => a.line - b.line), placed: 0, totalCharge: 0 };

  // One chain per line, planned before the transaction for the same reason as
  // the single-order path. A line whose upstream cannot be planned is reported
  // and dropped rather than failing the whole batch.
  const plans = new Map<number, ChainHop[]>();
  for (const p of [...parsed]) {
    const plan = await planUpstream(p.service, p.quantity);
    if ("error" in plan) {
      await logActivity(user.id, "order.chain.blocked", `line ${p.line}: ${plan.detail}`);
      results.push({ line: p.line, raw: p.raw, ok: false, message: plan.error });
      parsed.splice(parsed.indexOf(p), 1);
      continue;
    }
    plans.set(p.line, plan.hops);
  }
  if (parsed.length === 0) return { results: results.sort((a, b) => a.line - b.line), placed: 0, totalCharge: 0 };

  const totalCharge = parsed.reduce((n, p) => n + p.charge, 0);
  const ids = await Promise.all(
    parsed.flatMap(() => [nextPublicId("order"), nextPublicId("transaction")])
  );

  let placed = 0;
  let charged = 0;

  try {
    await db.$transaction(async (tx) => {
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balance: true, spent: true } });
      if (fresh.balance < totalCharge) throw new Error("INSUFFICIENT_FUNDS");

      let balance = fresh.balance;
      for (const [i, p] of parsed.entries()) {
        const orderPublicId = ids[i * 2];
        const txPublicId = ids[i * 2 + 1];
        const order = await tx.order.create({
          data: {
            publicId: orderPublicId,
            userId: user.id,
            serviceId: p.service.id,
            link: p.link,
            quantity: p.quantity,
            charge: p.charge,
            remains: p.quantity,
            status: "pending",
            cost: (plans.get(p.line) ?? [])[0]?.charge ?? orderCost(p.service.providerRate, p.quantity),
          },
        });
        await writeUpstream(tx, plans.get(p.line) ?? [], {
          downstreamOrderId: order.id,
          link: p.link,
          quantity: p.quantity,
          runs: null,
          interval: null,
        });
        balance -= p.charge;
        await tx.transaction.create({
          data: {
            publicId: txPublicId,
            userId: user.id,
            type: "order",
            amount: -p.charge,
            currency: "base",
            status: "completed",
            reference: String(orderPublicId),
            note: p.service.name,
            balanceAfter: balance,
          },
        });
        results.push({ line: p.line, raw: p.raw, ok: true, message: `Order #${orderPublicId}` });
        placed += 1;
        charged += p.charge;
      }

      await tx.user.update({
        where: { id: user.id },
        data: { balance, spent: fresh.spent + totalCharge },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_FUNDS") {
      return {
        error: t("err.balanceOrders"),
        results: results.sort((a, b) => a.line - b.line),
        placed: 0,
        totalCharge,
      };
    }
    if (e instanceof Error && e.message === "UPSTREAM_FUNDS") {
      await logActivity(user.id, "order.chain.funds", `mass order, ${parsed.length} lines`);
      return {
        error: CHAIN_UNAVAILABLE,
        results: results.sort((a, b) => a.line - b.line),
        placed: 0,
        totalCharge,
      };
    }
    throw e;
  }

  await logActivity(user.id, "order.mass", `${placed} orders`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");

  return { results: results.sort((a, b) => a.line - b.line), placed, totalCharge: charged };
}
