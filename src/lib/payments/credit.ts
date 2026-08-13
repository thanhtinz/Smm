import { db } from "@/lib/db";

/**
 * Marks a pending deposit completed and moves the money.
 *
 * Idempotent: a webhook that fires twice, or a return URL hit alongside a
 * webhook, must not credit the balance twice. The status check happens inside
 * the transaction, so concurrent callers cannot both pass it.
 */
export async function creditDeposit(transactionId: string, reference?: string): Promise<"credited" | "already" | "missing"> {
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
  });
}

export async function failDeposit(transactionId: string, note: string) {
  await db.transaction.updateMany({
    where: { id: transactionId, status: "pending" },
    data: { status: "failed", note },
  });
}
