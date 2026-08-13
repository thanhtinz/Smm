import { db } from "@/lib/db";

export type CouponCheck =
  | { ok: true; couponId: string; code: string; bonus: number }
  | { ok: false; error: string };

/**
 * Validates a coupon against a deposit amount expressed in the base currency
 * and returns the bonus it would add. Reads redemptions rather than a counter,
 * so limits cannot drift.
 */
export async function evaluateCoupon(code: string, userId: string, amountInBase: number): Promise<CouponCheck> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "Enter a coupon code" };

  const coupon = await db.coupon.findFirst({ where: { code: trimmed } });
  if (!coupon || !coupon.enabled) return { ok: false, error: "That coupon is not valid" };

  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "That coupon has expired" };
  }
  if (coupon.minAmount > 0 && amountInBase < coupon.minAmount) {
    return { ok: false, error: `This coupon needs a deposit of at least ${coupon.minAmount.toLocaleString()}` };
  }

  if (coupon.maxUses > 0) {
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id } });
    if (used >= coupon.maxUses) return { ok: false, error: "That coupon has been fully used" };
  }
  if (coupon.maxPerUser > 0) {
    const mine = await db.couponRedemption.count({ where: { couponId: coupon.id, userId } });
    if (mine >= coupon.maxPerUser) return { ok: false, error: "You have already used this coupon" };
  }
  if (coupon.firstDepositOnly) {
    const previous = await db.transaction.count({
      where: { userId, type: "deposit", status: "completed" },
    });
    if (previous > 0) return { ok: false, error: "This coupon is for a first deposit only" };
  }

  const bonus =
    coupon.type === "fixed" ? Math.round(coupon.value) : Math.round((amountInBase * coupon.value) / 100);
  if (bonus <= 0) return { ok: false, error: "That coupon adds nothing to this deposit" };

  return { ok: true, couponId: coupon.id, code: coupon.code, bonus };
}

/**
 * Records the redemption. The unique constraint on transactionId is what
 * stops one deposit consuming a coupon twice.
 */
export async function redeemCoupon(couponId: string, userId: string, transactionId: string, bonus: number) {
  try {
    await db.couponRedemption.create({ data: { couponId, userId, transactionId, bonus } });
    return true;
  } catch {
    return false;
  }
}
