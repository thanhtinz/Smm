import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { nextPublicId } from "@/lib/ids";

/** Short, unambiguous codes — no O/0 or I/1 confusion when typed by hand. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(length = 8) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Issues a referral code on demand, so no backfill was needed. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    try {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // Unique clash: try another code.
    }
  }
  throw new Error("Could not allocate a referral code");
}

export async function findReferrerByCode(code: string) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  return db.user.findFirst({
    where: { referralCode: trimmed, banned: false },
    select: { id: true, username: true },
  });
}

/**
 * Pays the referrer their share of a completed deposit. The unique constraint
 * on transactionId is what makes this safe to call more than once — a
 * re-delivered webhook cannot pay commission twice.
 */
export async function payReferralCommission(transactionId: string): Promise<number> {
  if (!(await getSetting("affiliate.enabled"))) return 0;

  const txn = await db.transaction.findUnique({
    where: { id: transactionId },
    include: { user: { select: { id: true, referredById: true } } },
  });
  if (!txn || txn.type !== "deposit" || txn.status !== "completed") return 0;

  const referrerId = txn.user.referredById;
  if (!referrerId || referrerId === txn.userId) return 0;

  const percent = Number(await getSetting("affiliate.commissionPercent")) || 0;
  if (percent <= 0) return 0;

  const amount = Math.round((txn.amount * percent) / 100);
  if (amount <= 0) return 0;

  try {
    await db.referralEarning.create({
      data: {
        referrerId,
        referredId: txn.userId,
        transactionId: txn.id,
        amount,
        ratePercent: percent,
      },
    });
  } catch {
    // Already paid for this deposit.
    return 0;
  }

  await db.notification.create({
    data: {
      userId: referrerId,
      title: "Referral commission earned",
      body: "One of your referrals topped up their balance.",
      level: "success",
      href: "/dashboard/affiliate",
    },
  });

  return amount;
}

/**
 * Moves earned commission into the referrer's spendable balance.
 *
 * Failures come back as a translation key plus its variables rather than a
 * sentence, so the caller can render them in the viewer's language.
 */
export type WithdrawFailure = { key: string; vars?: Record<string, number> };

export async function withdrawReferralEarnings(
  userId: string,
): Promise<{ moved: number; error?: WithdrawFailure }> {
  const minimum = Number(await getSetting("affiliate.minWithdraw")) || 0;

  const earned = await db.referralEarning.findMany({
    where: { referrerId: userId, status: "earned" },
    select: { id: true, amount: true },
  });
  const total = earned.reduce((n, e) => n + e.amount, 0);

  if (total <= 0) return { moved: 0, error: { key: "affiliate.error.empty" } };
  if (minimum > 0 && total < minimum) {
    return { moved: 0, error: { key: "affiliate.error.min", vars: { amount: minimum } } };
  }

  const publicId = await nextPublicId("transaction");

  await db.$transaction(async (tx) => {
    // Flip only the rows read above, so commission earned mid-withdrawal is
    // left for the next one rather than being paid out unrecorded.
    const flipped = await tx.referralEarning.updateMany({
      where: { id: { in: earned.map((e) => e.id) }, status: "earned" },
      data: { status: "withdrawn" },
    });
    if (flipped.count === 0) throw new Error("EMPTY");

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } });
    const balanceAfter = user.balance + total;

    await tx.user.update({ where: { id: userId }, data: { balance: balanceAfter } });
    await tx.transaction.create({
      data: {
        publicId,
        userId,
        type: "bonus",
        amount: total,
        status: "completed",
        note: "Referral commission",
        balanceAfter,
      },
    });
  });

  return { moved: total };
}
