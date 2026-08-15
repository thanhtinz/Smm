import type { Panel } from "@prisma/client";
import { db } from "./db";
import { basePrisma } from "./db-base";
import { runAsPanel } from "./tenancy";
import { getSetting } from "./settings";
import { nextPublicId } from "./ids";
import { subtreeOf } from "./panels";
import { notification } from "./notify";
import { formatLocalDay } from "./dates";

/**
 * Rent for child panels.
 *
 * Each panel sets what it charges its own children, and a child can be given
 * its own price when one was negotiated. Rent comes out of the owner's balance
 * on the parent panel — the same balance wholesale orders are paid from, which
 * is why it is read inside the transaction rather than before it.
 */

const DAY = 24 * 60 * 60 * 1000;

export type RentTerms = { price: number; periodDays: number; graceDays: number };

/** The terms a panel is billed on, read from its parent. */
export async function rentTermsFor(panel: Panel): Promise<RentTerms | null> {
  if (!panel.parentId) return null;

  return runAsPanel(panel.parentId, async () => ({
    price: panel.rentPrice ?? (Number(await getSetting("panel.rentPrice")) || 0),
    periodDays: Math.max(1, Number(await getSetting("panel.rentPeriodDays")) || 30),
    graceDays: Math.max(0, Number(await getSetting("panel.graceDays")) || 0),
  }));
}

export type BillingOutcome =
  | { panel: string; result: "charged"; amount: number; nextDueAt: Date }
  | { panel: string; result: "free" | "not-due" | "no-owner" }
  | { panel: string; result: "unpaid"; shortBy: number }
  | { panel: string; result: "expired" | "reactivated" };

/**
 * Charges every child panel that has come due, and expires the ones that have
 * been unpaid past their grace period.
 *
 * Expiry takes the whole subtree with it: a panel whose parent has stopped
 * trading cannot buy from it. Paying up brings the subtree back, but only the
 * panels that expiry switched off — one suspended by hand stays that way.
 */
export async function billPanelRent(now = new Date()): Promise<BillingOutcome[]> {
  const panels = await basePrisma.panel.findMany({
    where: { parentId: { not: null } },
    orderBy: { depth: "asc" },
  });

  const outcomes: BillingOutcome[] = [];

  for (const panel of panels) {
    if (panel.status === "suspended") continue;

    const terms = await rentTermsFor(panel);
    if (!terms || terms.price <= 0) {
      outcomes.push({ panel: panel.slug, result: "free" });
      continue;
    }

    // A panel that has never been billed starts its first period now, so
    // turning rent on does not immediately charge for time already used.
    const due = panel.nextDueAt ?? new Date(now.getTime() + terms.periodDays * DAY);
    if (!panel.nextDueAt) {
      await basePrisma.panel.update({ where: { id: panel.id }, data: { nextDueAt: due } });
      outcomes.push({ panel: panel.slug, result: "not-due" });
      continue;
    }
    if (due > now) {
      outcomes.push({ panel: panel.slug, result: "not-due" });
      continue;
    }

    if (!panel.ownerUserId) {
      outcomes.push({ panel: panel.slug, result: "no-owner" });
      continue;
    }

    const charged = await chargeRent(panel, terms, due, now);
    if (charged.ok) {
      outcomes.push({ panel: panel.slug, result: "charged", amount: terms.price, nextDueAt: charged.nextDueAt });
      if (panel.status === "expired") {
        await reactivate(panel);
        outcomes.push({ panel: panel.slug, result: "reactivated" });
      }
      continue;
    }

    outcomes.push({ panel: panel.slug, result: "unpaid", shortBy: charged.shortBy });

    if (now.getTime() > due.getTime() + terms.graceDays * DAY && panel.status !== "expired") {
      await expire(panel);
      outcomes.push({ panel: panel.slug, result: "expired" });
    }
  }

  return outcomes;
}

async function chargeRent(
  panel: Panel,
  terms: RentTerms,
  due: Date,
  now: Date,
): Promise<{ ok: true; nextDueAt: Date } | { ok: false; shortBy: number }> {
  const parentId = panel.parentId!;

  // The next period runs from the date that was due, not from today, so a late
  // payment does not quietly extend the subscription.
  const nextDueAt = new Date(due.getTime() + terms.periodDays * DAY);

  // One period, one reference. It is what makes a re-run after a crash between
  // the charge and the date bump find the payment instead of taking it twice.
  // Deliberately UTC, unlike everything below: this is an idempotency key,
  // not a date anybody reads, and it has to name the same period from every
  // process on every host.
  const reference = `${panel.slug}@${due.toISOString().slice(0, 10)}`;
  const publicId = await runAsPanel(parentId, () => nextPublicId("transaction"));
  // The owner reads this one, and they read it on the parent panel.
  const timezone = await runAsPanel(parentId, async () => String(await getSetting("locale.timezone")) || "UTC");

  const charged = await runAsPanel(parentId, async () => {
    try {
      return await db.$transaction(async (tx) => {
        const already = await tx.transaction.findFirst({
          where: { userId: panel.ownerUserId, type: "rent", reference },
          select: { id: true },
        });
        if (already) return { ok: true as const };

        const owner = await tx.user.findUniqueOrThrow({
          where: { id: panel.ownerUserId },
          select: { balance: true },
        });
        if (owner.balance < terms.price) throw new ShortFall(terms.price - owner.balance);

        const balanceAfter = owner.balance - terms.price;
        await tx.user.update({ where: { id: panel.ownerUserId }, data: { balance: balanceAfter } });
        await tx.transaction.create({
          data: {
            publicId,
            userId: panel.ownerUserId,
            type: "rent",
            amount: -terms.price,
            status: "completed",
            reference,
            note: `Panel rent · ${panel.name}`,
            balanceAfter,
          },
        });
        await tx.notification.create({
          data: notification({
            userId: panel.ownerUserId,
            key: "panel.rent",
            params: { panel: panel.name, until: formatLocalDay(nextDueAt, timezone) },
            href: "/dashboard/transactions",
          }),
        });

        return { ok: true as const };
      });
    } catch (error) {
      if (error instanceof ShortFall) return { ok: false as const, shortBy: error.shortBy };
      throw error;
    }
  });

  if (!charged.ok) return charged;

  // Outside the transaction: Panel is not a tenant table, so writing it from
  // inside would take a second connection and deadlock SQLite's single writer.
  await basePrisma.panel.update({ where: { id: panel.id }, data: { nextDueAt, lastBilledAt: now } });
  return { ok: true as const, nextDueAt };
}

class ShortFall extends Error {
  constructor(public shortBy: number) {
    super("SHORTFALL");
  }
}

async function expire(panel: Panel) {
  const subtree = await runAsPanel(panel.id, () => subtreeOf(panel));
  await basePrisma.panel.updateMany({
    where: { id: { in: subtree.map((p) => p.id) }, status: { not: "suspended" } },
    data: { status: "expired", statusNote: "Rent unpaid" },
  });

  if (panel.ownerUserId && panel.parentId) {
    await runAsPanel(panel.parentId, () =>
      db.notification.create({
        data: notification({
          userId: panel.ownerUserId,
          key: "panel.suspended",
          params: { panel: panel.name },
          level: "danger",
          href: "/dashboard/wallet",
        }),
      }),
    );
  }
}

async function reactivate(panel: Panel) {
  const subtree = await runAsPanel(panel.id, () => subtreeOf(panel));
  // Only what expiry switched off. A panel suspended by hand stays suspended.
  await basePrisma.panel.updateMany({
    where: { id: { in: subtree.map((p) => p.id) }, status: "expired" },
    data: { status: "active", statusNote: "" },
  });
}
