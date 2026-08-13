"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { nextPublicId } from "@/lib/ids";
import { calculateCharge, isValidOrderLink } from "@/lib/orders";

export type OrderState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: { orderId: number; charge: number };
};

export async function placeOrderAction(_prev: OrderState, formData: FormData): Promise<OrderState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  if (!(await getSetting("order.enabled"))) {
    return { error: "Ordering is temporarily disabled." };
  }

  const serviceId = String(formData.get("serviceId") ?? "");
  const link = String(formData.get("link") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!serviceId) fieldErrors.serviceId = "Choose a service";
  if (!link) fieldErrors.link = "Enter the link for this order";
  else if (!isValidOrderLink(link)) fieldErrors.link = "Enter a full link starting with http:// or https://";

  const quantity = Number(quantityRaw);
  if (!quantityRaw) fieldErrors.quantity = "Enter a quantity";
  else if (!Number.isInteger(quantity) || quantity <= 0) fieldErrors.quantity = "Quantity must be a whole number";

  // Drip-feed splits one order into `runs` deliveries spaced `interval`
  // minutes apart, so the charge is quantity × runs.
  const dripfeed = formData.get("dripfeed") === "on";
  const runs = dripfeed ? Number(formData.get("runs") ?? 0) : 0;
  const interval = dripfeed ? Number(formData.get("interval") ?? 0) : 0;
  if (dripfeed) {
    if (!Number.isInteger(runs) || runs < 2) fieldErrors.runs = "Runs must be 2 or more";
    if (!Number.isInteger(interval) || interval < 1) fieldErrors.interval = "Interval must be at least 1 minute";
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const service = await db.service.findFirst({ where: { id: serviceId, enabled: true } });
  if (!service) return { fieldErrors: { serviceId: "That service is no longer available" } };
  if (dripfeed && !service.dripfeed) {
    return { fieldErrors: { dripfeed: "This service does not support drip-feed" } };
  }

  if (quantity < service.min || quantity > service.max) {
    return {
      fieldErrors: {
        quantity: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}`,
      },
    };
  }

  const totalQuantity = dripfeed ? quantity * runs : quantity;
  const charge = calculateCharge(service.rate, totalQuantity);
  const minCharge = Number(await getSetting("order.minCharge")) || 0;
  if (charge < minCharge) {
    return { fieldErrors: { quantity: `The minimum order value is ${minCharge.toLocaleString()}` } };
  }

  // The counter table lives on its own connection, so ids are allocated before
  // the transaction opens — writing to it mid-transaction risks SQLITE_BUSY.
  const [orderPublicId, txPublicId] = await Promise.all([nextPublicId("order"), nextPublicId("transaction")]);

  // Re-read the balance inside the transaction so two concurrent submissions
  // cannot both pass the check and overdraw the account.
  try {
    const result = await db.$transaction(async (tx) => {
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balance: true, spent: true } });
      if (fresh.balance < charge) throw new Error("INSUFFICIENT_FUNDS");

      const order = await tx.order.create({
        data: {
          publicId: orderPublicId,
          userId: user.id,
          serviceId: service.id,
          link,
          quantity: totalQuantity,
          charge,
          remains: totalQuantity,
          status: "pending",
          runs: dripfeed ? runs : null,
          interval: dripfeed ? interval : null,
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

      return order;
    });

    await logActivity(user.id, "order.create", `#${result.publicId} ${service.name} x${quantity}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");

    return { success: { orderId: result.publicId, charge } };
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_FUNDS") {
      return { error: "Your balance is not enough for this order. Top up and try again." };
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
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired. Please sign in again." };
  if (!(await getSetting("order.enabled"))) return { error: "Ordering is temporarily disabled." };

  const lines = String(formData.get("bulk") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { error: "Paste at least one line." };
  if (lines.length > 100) return { error: "A maximum of 100 lines can be submitted at once." };

  const services = await db.service.findMany({ where: { enabled: true } });
  const byPublicId = new Map(services.map((s) => [String(s.publicId), s]));

  type Parsed = { line: number; raw: string; service: (typeof services)[number]; link: string; quantity: number; charge: number };
  const parsed: Parsed[] = [];
  const results: NonNullable<MassOrderState["results"]> = [];

  lines.forEach((raw, i) => {
    const line = i + 1;
    const parts = raw.split("|").map((p) => p.trim());
    if (parts.length !== 3) {
      results.push({ line, raw, ok: false, message: "Expected service_id | link | quantity" });
      return;
    }
    const [idPart, link, qtyPart] = parts;
    const service = byPublicId.get(idPart);
    if (!service) {
      results.push({ line, raw, ok: false, message: `Unknown service id ${idPart}` });
      return;
    }
    if (!isValidOrderLink(link)) {
      results.push({ line, raw, ok: false, message: "Invalid link" });
      return;
    }
    const quantity = Number(qtyPart);
    if (!Number.isInteger(quantity) || quantity < service.min || quantity > service.max) {
      results.push({
        line,
        raw,
        ok: false,
        message: `Quantity must be ${service.min.toLocaleString()}–${service.max.toLocaleString()}`,
      });
      return;
    }
    parsed.push({ line, raw, service, link, quantity, charge: calculateCharge(service.rate, quantity) });
  });

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
        await tx.order.create({
          data: {
            publicId: orderPublicId,
            userId: user.id,
            serviceId: p.service.id,
            link: p.link,
            quantity: p.quantity,
            charge: p.charge,
            remains: p.quantity,
            status: "pending",
          },
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
        error: "Your balance is not enough for these orders. Nothing was placed.",
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
