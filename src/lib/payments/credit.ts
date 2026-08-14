import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { payReferralCommission } from "@/lib/affiliate";

/**
 * Marks a pending deposit completed and moves the money.
 *
 * Idempotent: a webhook that fires twice, or a return URL hit alongside a
 * webhook, must not credit the balance twice. The status check happens inside
 * the transaction, so concurrent callers cannot both pass it.
 */
export async function creditDeposit(
  transactionId: string,
  reference?: string,
  { automatic = false }: { automatic?: boolean } = {},
): Promise<"credited" | "held" | "already" | "missing"> {
  // A panel that reviews its payments still wants the arrival recorded — the
  // difference is whether the balance moves before someone has looked.
  if (automatic && !(await getSetting("wallet.autoApprove"))) {
    return holdForReview(transactionId, reference);
  }

  return db.$transaction(async (tx) => {
    const txn = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!txn || txn.type !== "deposit") return "missing";
    if (txn.status === "completed") return "already";

    const user = await tx.user.findUniqueOrThrow({ where: { id: txn.userId }, select: { balance: true } });
    const balanceAfter = user.balance + txn.amount;

    await tx.user.update({ where: { id: txn.userId }, data: { balance: balanceAfter } });
    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        status: "completed",
        balanceAfter,
        ...(reference ? { reference } : {}),
      },
    });
    await tx.notification.create({
      data: {
        userId: txn.userId,
        title: "Balance topped up",
        body: `Deposit #${txn.publicId} has been credited to your account.`,
        level: "success",
        href: "/dashboard/transactions",
      },
    });

    return "credited";
  }).then(async (outcome) => {
    // Commission is paid outside the balance transaction: it targets a
    // different account, and its own unique constraint makes it idempotent.
    if (outcome === "credited") await payReferralCommission(transactionId);
    return outcome;
  });
}

/**
 * Records that the money arrived without moving the balance.
 *
 * `review` rather than leaving it pending, so an operator can tell a payment
 * waiting on them from one waiting on the customer. Approving it from the
 * admin area credits it through the same path as any other deposit.
 */
async function holdForReview(transactionId: string, reference?: string): Promise<"held" | "already" | "missing"> {
  const txn = await db.transaction.findUnique({ where: { id: transactionId } });
  if (!txn || txn.type !== "deposit") return "missing";
  if (txn.status === "completed" || txn.status === "review") return "already";

  await db.transaction.update({
    where: { id: transactionId },
    data: { status: "review", ...(reference ? { reference } : {}) },
  });

  const admins = await db.user.findMany({ where: { role: "admin", banned: false }, select: { id: true } });
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title: `Deposit #${txn.publicId} is waiting for approval`,
        body: "The payment arrived. Approve it to credit the balance.",
        level: "warning",
        href: "/admin/transactions",
      })),
    });
  }

  return "held";
}

export async function failDeposit(transactionId: string, note: string) {
  await db.transaction.updateMany({
    where: { id: transactionId, status: "pending" },
    data: { status: "failed", note },
  });
}
