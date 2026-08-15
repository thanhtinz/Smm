/**
 * How much of an order's charge is still owed back.
 *
 * There are two paths that hand money back — a provider reporting a partial or
 * a cancellation, and an operator changing the status by hand — and until this
 * existed they each decided on their own. The provider path asked "has any
 * refund been paid for this order", the operator path asked "was the status
 * already a refunding one". Neither question is the right one, and together
 * they overpaid: an order refunded 30% for a partial delivery and then
 * cancelled paid the full charge again, putting 130% of the price back in the
 * customer's wallet.
 *
 * The right question is arithmetic. Whatever has already been paid back for
 * this order is subtracted from the charge, and what remains is what is owed —
 * which is the full charge on a fresh order, the remainder on a partly
 * refunded one, and nothing at all on one already settled.
 */

/** The transaction rows this reads, narrowed so a `$transaction` handle fits. */
export type RefundClient = {
  transaction: {
    aggregate: (args: {
      where: { userId: string; type: string; reference: string };
      _sum: { amount: true };
    }) => Promise<{ _sum: { amount: number | null } }>;
  };
};

export async function refundOwed(
  client: RefundClient,
  order: { userId: string; publicId: number; charge: number },
): Promise<number> {
  const paid = await client.transaction.aggregate({
    // Refunds are recorded against the order's public id, which repeats across
    // panels but not within one — and Transaction is panel-scoped.
    where: { userId: order.userId, type: "refund", reference: String(order.publicId) },
    _sum: { amount: true },
  });

  // Rounded because a partial refund is a rounded share of the charge, and a
  // sum of those against an unrounded charge would leave a stray dong owed
  // for ever.
  return Math.max(0, Math.round(order.charge - (paid._sum.amount ?? 0)));
}
