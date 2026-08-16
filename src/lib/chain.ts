import type { Service } from "@prisma/client";
import { db } from "./db";
import { basePrisma } from "./db-base";
import { runAsPanel } from "./tenancy";
import { nextPublicId } from "./ids";
import { calculateCharge, orderCost, subscriptionFields, type Subscription } from "./orders";
import { priceService, resolvePricing } from "./pricing";
import { getBaseCurrency } from "./currency";

/**
 * A child panel sells what its parent sells. When one of its customers orders,
 * the same order has to be placed again one level up, paid for by the child
 * owner's account there, and again above that, until it reaches a panel that
 * buys from an outside provider.
 *
 * The whole chain is planned first and written in a single transaction, so a
 * customer is never charged for an order the level above refused.
 */

/** Bounded well below the depth limit; a longer chain means a broken link. */
const MAX_HOPS = 6;

export type ChainHop = {
  panelId: string;
  panelName: string;
  userId: string;
  serviceId: string;
  serviceName: string;
  rate: number;
  charge: number;
  /** What that panel's own provider charges, for the last hop's cost. */
  providerRate: number;
  orderPublicId: number;
  txPublicId: number;
};

export type ChainPlan = { hops: ChainHop[] } | { error: string; detail: string };

/**
 * Works out every order that has to exist upstream of this one, and what each
 * level pays. Reads only — nothing is written until the caller opens its
 * transaction.
 *
 * `detail` carries the real reason for the log; `error` is what the customer
 * is allowed to see. A child's customer should not learn that the panel above
 * is out of funds.
 */
export async function planUpstream(
  service: Pick<Service, "id" | "panelId" | "sourceServiceId" | "name">,
  totalQuantity: number,
): Promise<ChainPlan> {
  const hops: ChainHop[] = [];
  // Currencies are shared by every panel in the tree, so the base — and its
  // precision — is the same at every hop and is read once.
  const money = (await getBaseCurrency()).decimals;

  let current = service;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (!current.sourceServiceId) return { hops };

    const panel = await basePrisma.panel.findUnique({ where: { id: current.panelId } });
    if (!panel?.parentId) return { hops };
    if (panel.status !== "active") {
      return { error: unavailable, detail: `panel ${panel.slug} is ${panel.status}` };
    }

    const parentId = panel.parentId;
    type Upstream = { hop: ChainHop; next: Service } | { detail: string };
    const upstream: Upstream = await runAsPanel(parentId, async (): Promise<Upstream> => {
      const owner = panel.ownerUserId
        ? await db.user.findUnique({ where: { id: panel.ownerUserId } })
        : null;
      if (!owner) return { detail: `panel ${panel.slug} has no owner account on its parent` };
      if (owner.banned) return { detail: `owner of ${panel.slug} is suspended` };

      const parentService = await db.service.findFirst({
        where: { id: current.sourceServiceId, enabled: true },
      });
      if (!parentService) return { detail: `source service for "${current.name}" is gone or disabled` };
      if (totalQuantity < parentService.min || totalQuantity > parentService.max) {
        return {
          detail: `quantity ${totalQuantity} is outside ${parentService.min}-${parentService.max} on ${parentService.name}`,
        };
      }

      // The owner's own tier decides the wholesale price, so a panel can put
      // its resellers on better rates the same way it does customers.
      const rate = await priceService(await resolvePricing(owner), parentService);
      const [orderPublicId, txPublicId] = await Promise.all([
        nextPublicId("order"),
        nextPublicId("transaction"),
      ]);

      const parentPanel = await basePrisma.panel.findUniqueOrThrow({ where: { id: parentId } });
      return {
        hop: {
          panelId: parentId,
          panelName: parentPanel.name,
          userId: owner.id,
          serviceId: parentService.id,
          serviceName: parentService.name,
          rate,
          charge: calculateCharge(rate, totalQuantity, money),
          providerRate: parentService.providerRate,
          orderPublicId,
          txPublicId,
        } satisfies ChainHop,
        next: parentService,
      };
    });

    if (!("hop" in upstream)) return { error: unavailable, detail: upstream.detail };

    hops.push(upstream.hop);
    current = upstream.next;
  }

  return { error: unavailable, detail: `chain longer than ${MAX_HOPS} hops from ${service.name}` };
}

/** Deliberately vague: the customer is not a party to the panels above. */
const unavailable = "This service is temporarily unavailable. Please try another or contact support.";

export const CHAIN_UNAVAILABLE = unavailable;

/**
 * Writes the upstream orders inside the caller's transaction and returns the
 * ids created. Throws `UPSTREAM_FUNDS` when a level cannot pay, which rolls
 * the customer's own order back with it.
 */
/** The client Prisma hands a `$transaction` callback: no lifecycle methods. */
type TxClient = Omit<typeof db, "$connect" | "$disconnect" | "$transaction" | "$extends" | "$on" | "$use">;

export async function writeUpstream(
  tx: TxClient,
  hops: ChainHop[],
  base: {
    downstreamOrderId: string;
    link: string;
    comments?: string;
    quantity: number;
    runs: number | null;
    interval: number | null;
    subscription?: Subscription | null;
  },
): Promise<string[]> {
  const created: string[] = [];
  const money = (await getBaseCurrency()).decimals;
  let downstream = base.downstreamOrderId;

  for (const [index, hop] of hops.entries()) {
    const id = await runAsPanel(hop.panelId, async () => {
      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: hop.userId },
        select: { balance: true, spent: true },
      });
      if (fresh.balance < hop.charge) throw new Error("UPSTREAM_FUNDS");

      const order = await tx.order.create({
        data: {
          publicId: hop.orderPublicId,
          userId: hop.userId,
          serviceId: hop.serviceId,
          link: base.link,
          quantity: base.quantity,
          charge: hop.charge,
          remains: base.quantity,
          status: "pending",
          // The comments travel with the order: the panel that finally sends
          // it to a provider is the one that needs them.
          comments: base.comments ?? "",
          sourceOrderId: downstream,
          runs: base.runs,
          interval: base.interval,
          // Each hop is bought from the one above it; the topmost buys from a
          // provider, so its cost comes from the service instead.
          cost: hops[index + 1]?.charge ?? orderCost(hop.providerRate, base.quantity, money),
          ...subscriptionFields(base.subscription ?? null),
        },
      });

      const balanceAfter = fresh.balance - hop.charge;
      await tx.user.update({
        where: { id: hop.userId },
        data: { balance: balanceAfter, spent: fresh.spent + hop.charge },
      });
      await tx.transaction.create({
        data: {
          publicId: hop.txPublicId,
          userId: hop.userId,
          type: "order",
          amount: -hop.charge,
          status: "completed",
          reference: String(hop.orderPublicId),
          note: `Order #${hop.orderPublicId} · ${hop.serviceName}`,
          balanceAfter,
        },
      });

      return order.id;
    });

    created.push(id);
    downstream = id;
  }

  return created;
}
