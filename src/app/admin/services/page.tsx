import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import ServiceManager from "@/components/admin/service-manager";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  const ctx = await getAppContext();
  const { t } = ctx;

  const [services, categories, platforms, providers] = await Promise.all([
    db.service.findMany({ orderBy: [{ position: "asc" }, { publicId: "asc" }] }),
    db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    db.platform.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    db.provider.findMany({ orderBy: { name: "asc" } }),
  ]);

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
        platforms={platforms.map((p) => ({ id: p.id, name: p.name, icon: p.icon, color: p.color }))}
        providers={providers.map((p) => ({ id: p.id, name: p.name }))}
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
          rate: t("admin.rate"),
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
