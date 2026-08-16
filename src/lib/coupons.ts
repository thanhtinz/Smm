import { db } from "@/lib/db";
import { roundMoney } from "@/lib/money";
import { getBaseCurrency } from "@/lib/currency";
import { formatCount } from "@/lib/numbers";

export type CouponCheck =
  | { ok: true; couponId: string; code: string; bonus: number }
  // What was wrong, for the caller to say in the reader's language.
  | { ok: false; key: string; vars?: Record<string, string | number> };

/**
 * Validates a coupon against a deposit amount expressed in the base currency
 * and returns the bonus it would add. Reads redemptions rather than a counter,
 * so limits cannot drift.
 */
export async function evaluateCoupon(
  code: string,
  userId: string,
  amountInBase: number,
  /** Whose digit grouping the minimum is quoted in. */
  locale: string,
): Promise<CouponCheck> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, key: "err.couponRequired" };

  const coupon = await db.coupon.findFirst({ where: { code: trimmed } });
  if (!coupon || !coupon.enabled) return { ok: false, key: "err.couponInvalid" };

  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { ok: false, key: "err.couponExpired" };
  }
  if (coupon.minAmount > 0 && amountInBase < coupon.minAmount) {
    return { ok: false, key: "err.couponMin", vars: { amount: formatCount(coupon.minAmount, locale) } };
  }

  if (coupon.maxUses > 0) {
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id } });
    if (used >= coupon.maxUses) return { ok: false, key: "err.couponUsedUp" };
  }
  if (coupon.maxPerUser > 0) {
    const mine = await db.couponRedemption.count({ where: { couponId: coupon.id, userId } });
    if (mine >= coupon.maxPerUser) return { ok: false, key: "err.couponUsed" };
  }
  if (coupon.firstDepositOnly) {
    const previous = await db.transaction.count({
      where: { userId, type: "deposit", status: "completed" },
    });
    if (previous > 0) return { ok: false, key: "err.couponFirstOnly" };
  }

  const money = (await getBaseCurrency()).decimals;
  const bonus =
    coupon.type === "fixed" ? roundMoney(coupon.value, money) : roundMoney((amountInBase * coupon.value) / 100, money);
  if (bonus <= 0) return { ok: false, key: "err.couponNoBonus" };

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
