import { formatRate } from "@/lib/money";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import ServiceManager from "@/components/admin/service-manager";
import { requirePanel, runAsPanel } from "@/lib/tenancy";
import { priceServices, resolvePricing } from "@/lib/pricing";
import { convert, displayMoney } from "@/lib/currency";
import { orderRoutes } from "@/lib/routing";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  const ctx = await getAppContext();
  const { t, locale } = ctx;

  const panel = await requirePanel();
  const isChild = panel.parentId !== null;

  const [services, categories, platforms, providers, tiers] = await Promise.all([
    db.service.findMany({
      orderBy: [{ position: "asc" }, { publicId: "asc" }],
      include: {
        tierPrices: { select: { tierId: true, rate: true } },
        routes: {
          include: { provider: { select: { id: true, name: true, enabled: true, balance: true, lastSyncAt: true } } },
        },
      },
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
        const rates = await priceServices(await resolvePricing(owner), rows);
        for (const s of rows) sourceCosts.set(s.id, rates.get(s.id) ?? s.rate);
        return rows.map((s) => ({
          id: s.id,
          name: `#${s.publicId} ${s.category.name} · ${s.name}`,
          // A per-1,000 price, so it keeps the places the currency does not.
          cost: formatRate(convert(rates.get(s.id) ?? s.rate, ctx.currency), ctx.currency),
        }));
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ServiceManager
        locale={locale}
        rows={services.map((s) => ({
          id: s.id,
          publicId: s.publicId,
          name: s.name,
          description: s.description,
          categoryId: s.categoryId,
          providerId: s.providerId,
          providerServiceId: s.providerServiceId,
          backupProviderId: s.backupProviderId,
          backupProviderServiceId: s.backupProviderServiceId,
          sourceServiceId: s.sourceServiceId,
          sourceCost: sourceCosts.get(s.sourceServiceId) ?? 0,
          tierPrices: Object.fromEntries(s.tierPrices.map((t) => [t.tierId, String(t.rate)])),
          autoPrice: s.autoPrice,
          type: s.type,
          target: s.target,
          // Ordered here the same way dispatch will order them, so the list an
          // operator reads is the list that will actually be tried.
          routes: orderRoutes(s.routes).map((r) => ({
            id: s.routes.find((row) => row.providerId === r.providerId)!.id,
            providerId: r.providerId,
            providerName: r.providerName,
            providerServiceId: r.providerServiceId,
            cost: r.cost,
            enabled: s.routes.find((row) => row.providerId === r.providerId)!.enabled,
            skipped: r.skipped ?? "",
            primary: r.providerId === s.providerId,
            costLabel: r.cost > 0 ? displayMoney(r.cost, ctx.currency, ctx.locale) : t("route.unknownCost"),
          })),
          rate: s.rate,
          providerRate: s.providerRate,
          min: s.min,
          max: s.max,
          refill: s.refill,
          cancel: s.cancel,
          dripfeed: s.dripfeed,
          averageTime: s.averageTime,
          tags: s.tags,
          warrantyDays: s.warrantyDays,
          startMinutes: s.startMinutes,
          speedPerDay: s.speedPerDay,
          enabled: s.enabled,
          position: s.position,
          increment: s.increment,
          overflowPercent: s.overflowPercent,
          deleted: s.deletedAt !== null,
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
          numberFormat: ctx.currency.numberFormat,
          rate: ctx.currency.rate,
          locale: ctx.locale,
        }}
        routeLabels={{
          title: t("route.title"),
          hint: t("route.hint"),
          add: t("route.add"),
          provider: t("route.provider"),
          serviceId: t("route.serviceId"),
          cost: t("route.cost"),
          empty: t("route.empty"),
          primary: t("route.primary"),
          balanceOut: t("route.balanceOut"),
          providerOff: t("route.providerOff"),
          enabled: t("admin.enabled"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
        labels={{
          close: t("common.close"),
          target: t("link.target"),
          targetHint: t("link.targetHint"),
          targetPost: t("link.target.post"),
          targetProfile: t("link.target.profile"),
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
          typeSpread: t("service.typeSpread"),
          increment: t("service.increment"),
          incrementHint: t("service.incrementHint"),
          overflow: t("service.overflow"),
          overflowHint: t("service.overflowHint"),
          restore: t("service.restore"),
          deletedView: t("service.deletedView"),
          selectAll: t("common.selectAll"),
          picked: t("common.picked"),
          apply: t("common.apply"),
          massMode: t("service.massMode"),
          massPercent: t("service.massPercent"),
          massSet: t("service.massSet"),
          massPercentValue: t("service.massPercentValue"),
          massSetValue: t("service.massSetValue"),
          massDone: t("service.massDone"),
          autoPrice: t("service.autoPrice"),
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
          startMinutes: t("order.factTime"),
          speedPerDay: t("order.factSpeed"),
          warrantyDays: t("order.factWarranty"),
          promiseHint: t("admin.promiseHint"),
          tags: t("admin.tags"),
          tagsHint: t("admin.tagsHint"),
          egTags: t("eg.serviceTags"),
          egAverageTime: t("eg.averageTime"),
          position: t("admin.position"),
          provider: t("admin.provider"),
          noProvider: t("admin.noProvider"),
          providerServiceId: t("admin.providerServiceId"),
          backupProvider: t("service.backupProvider"),
          backupHint: t("service.backupHint"),
          backupServiceId: t("service.backupServiceId"),
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
