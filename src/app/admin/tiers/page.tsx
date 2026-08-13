import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import TierManager from "@/components/admin/tier-manager";

export const metadata: Metadata = { title: "Tiers" };

export default async function AdminTiersPage() {
  const { t, currency, locale } = await getAppContext();

  const tiers = await db.userTier.findMany({
    orderBy: [{ position: "asc" }, { minSpent: "asc" }],
    include: { _count: { select: { users: true, prices: true } } },
  });

  // _count.users only sees customers moved here by hand. The number an
  // operator wants is everyone the tier actually prices, which includes those
  // the spend ladder puts here.
  const ladder = tiers.filter((x) => x.minSpent > 0).sort((a, b) => a.minSpent - b.minSpent);
  const members = new Map<string, number>();
  for (const tier of tiers) {
    const above = ladder.find((x) => x.minSpent > tier.minSpent);
    const auto =
      tier.minSpent > 0
        ? { spent: { gte: tier.minSpent, ...(above ? { lt: above.minSpent } : {}) } }
        : tier.isDefault
          ? { spent: ladder[0] ? { lt: ladder[0].minSpent } : {} }
          : null;

    members.set(
      tier.id,
      tier._count.users + (auto ? await db.user.count({ where: { tierId: null, ...auto } }) : 0),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <TierManager
        money={{
          symbol: currency.symbol,
          symbolBefore: currency.symbolBefore,
          decimals: currency.decimals,
          rate: currency.rate,
          locale,
        }}
        rows={tiers.map((x) => ({
          id: x.id,
          name: x.name,
          slug: x.slug,
          discountPercent: x.discountPercent,
          minSpent: x.minSpent,
          color: x.color,
          isDefault: x.isDefault,
          position: x.position,
          members: members.get(x.id) ?? 0,
          manualPrices: x._count.prices,
        }))}
        labels={{
          title: t("tier.title"),
          new: t("tier.new"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          empty: t("tier.empty"),
          tier: t("tier.tier"),
          discount: t("tier.discount"),
          minSpent: t("tier.minSpent"),
          minSpentHint: t("tier.minSpentHint"),
          starting: t("tier.starting"),
          members: t("tier.members"),
          manual: t("tier.manual"),
          name: t("admin.name"),
          slug: t("admin.slug"),
          color: t("admin.color"),
          position: t("admin.position"),
          save: t("common.save"),
        }}
      />
    </div>
  );
}
