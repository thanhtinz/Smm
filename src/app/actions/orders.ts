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

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const service = await db.service.findFirst({ where: { id: serviceId, enabled: true } });
  if (!service) return { fieldErrors: { serviceId: "That service is no longer available" } };

  if (quantity < service.min || quantity > service.max) {
    return {
      fieldErrors: {
        quantity: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}`,
      },
    };
  }

  const charge = calculateCharge(service.rate, quantity);
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
          quantity,
          charge,
          remains: quantity,
          status: "pending",
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
