import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import CouponManager from "@/components/admin/coupon-manager";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  const { t } = await getAppContext();

  const coupons = await db.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <CouponManager
        rows={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          value: c.value,
          minAmount: c.minAmount,
          maxUses: c.maxUses,
          maxPerUser: c.maxPerUser,
          firstDepositOnly: c.firstDepositOnly,
          enabled: c.enabled,
          expiresAt: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : "",
          used: c._count.redemptions,
        }))}
        labels={{
          close: t("common.close"),
          title: t("coupon.title"),
          new: t("admin.new"),
          edit: t("admin.edit"),
          confirmDelete: t("admin.confirmDelete"),
          empty: t("common.none"),
          code: t("admin.code"),
          type: t("admin.type"),
          value: t("coupon.value"),
          percent: t("coupon.percent"),
          fixed: t("coupon.fixed"),
          bonus: t("wallet.bonus"),
          minAmount: t("coupon.minAmount"),
          maxUses: t("coupon.maxUses"),
          maxPerUser: t("coupon.maxPerUser"),
          firstOnly: t("coupon.firstOnly"),
          zeroUnlimited: t("coupon.zeroUnlimited"),
          expires: t("coupon.expires"),
          used: t("coupon.used"),
          enabled: t("admin.enabled"),
          disabled: t("admin.disabled"),
          status: t("common.status"),
          actions: t("common.actions"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />
    </div>
  );
}
