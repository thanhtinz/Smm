import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import ServiceManager from "@/components/admin/service-manager";
import { requirePanel, runAsPanel } from "@/lib/tenancy";
import { priceServices, resolveTier } from "@/lib/pricing";
import { displayMoney } from "@/lib/currency";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  const ctx = await getAppContext();
  const { t } = ctx;

  const panel = await requirePanel();
  const isChild = panel.parentId !== null;

  const [services, categories, platforms, providers, tiers] = await Promise.all([
    db.service.findMany({
      orderBy: [{ position: "asc" }, { publicId: "asc" }],
      include: { tierPrices: { select: { tierId: true, rate: true } } },
    }),
    db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    db.platform.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    isChild ? [] : db.provider.findMany({ orderBy: { name: "asc" } }),
    db.userTier.findMany({ orderBy: [{ position: "asc" }, { minSpent: "asc" }] }),
  ]);

  // What this panel would pay for each of its parent's services, priced for
  // the owner's tier there — the cost side of every margin on this page.
  const sourceCosts = new Map<string, number>();
  const sourceServices = isChild
    ? await runAsPanel(panel.parentId!, async () => {
        const owner = panel.ownerUserId ? await db.user.findUnique({ where: { id: panel.ownerUserId } }) : null;
        const rows = await db.service.findMany({
          where: { enabled: true },
          orderBy: [{ position: "asc" }, { publicId: "asc" }],
          include: { category: { select: { name: true } } },
        });
        const rates = await priceServices(await resolveTier(owner), rows);
        for (const s of rows) sourceCosts.set(s.id, rates.get(s.id) ?? s.rate);
        return rows.map((s) => ({
          id: s.id,
          name: `#${s.publicId} ${s.category.name} · ${s.name}`,
          cost: displayMoney(rates.get(s.id) ?? s.rate, ctx.currency, ctx.locale),
        }));
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ServiceManager
        rows={services.map((s) => ({
          id: s.id,
          publicId: s.publicId,
          name: s.name,
          description: s.description,
          categoryId: s.categoryId,
          providerId: s.providerId,
          providerServiceId: s.providerServiceId,
          sourceServiceId: s.sourceServiceId,
          sourceCost: sourceCosts.get(s.sourceServiceId) ?? 0,
          tierPrices: Object.fromEntries(s.tierPrices.map((t) => [t.tierId, String(t.rate)])),
          type: s.type,
          rate: s.rate,
          providerRate: s.providerRate,
          min: s.min,
          max: s.max,
          refill: s.refill,
          cancel: s.cancel,
          dripfeed: s.dripfeed,
          averageTime: s.averageTime,
          enabled: s.enabled,
          position: s.position,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, platformId: c.platformId }))}
        platforms={platforms.map((p) => ({ id: p.id, name: p.name, icon: p.icon, image: p.image, color: p.color }))}
        providers={providers.map((p) => ({ id: p.id, name: p.name }))}
        sourceServices={sourceServices}
        tiers={tiers.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          discountPercent: t.discountPercent,
        }))}
        isChild={isChild}
        currency={{
          symbol: ctx.currency.symbol,
          symbolBefore: ctx.currency.symbolBefore,
          decimals: ctx.currency.decimals,
          rate: ctx.currency.rate,
          locale: ctx.locale,
        }}
        labels={{
          title: t("admin.services"),
          new: t("admin.new"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          empty: t("common.none"),
          search: t("common.search"),
          filter: t("admin.filter"),
          allPlatforms: t("admin.allPlatforms"),
          count: t("admin.services.count"),
          name: t("admin.name"),
          description: t("admin.description"),
          category: t("admin.category"),
          type: t("service.type"),
          typeDefault: t("service.typeDefault"),
          typeCustomComments: t("service.typeCustomComments"),
          typeSubscription: t("service.typeSubscription"),
          rate: t("admin.rate"),
          tierPrices: t("tier.prices"),
          tierPricesHint: t("tier.pricesHint"),
          manualPrice: t("tier.manualPrice"),
          sourceService: t("service.source"),
          sourceHint: t("service.sourceHint"),
          noSource: t("service.noSource"),
          providerRate: t("admin.providerRate"),
          margin: t("admin.margin"),
          limits: `${t("order.min")}/${t("order.max")}`,
          min: t("order.min"),
          max: t("order.max"),
          averageTime: t("admin.averageTime"),
          position: t("admin.position"),
          provider: t("admin.provider"),
          noProvider: t("admin.noProvider"),
          providerServiceId: t("admin.providerServiceId"),
          flags: t("admin.flags"),
          refill: t("order.refill"),
          cancelOption: t("order.cancel"),
          dripfeed: t("order.dripfeed"),
          enabled: t("admin.enabled"),
          disabled: t("admin.disabled"),
          status: t("common.status"),
          actions: t("common.actions"),
          save: t("common.save"),
          cancel: t("common.cancel"),
          needCategory: t("admin.needCategory"),
        }}
      />
    </div>
  );
}
