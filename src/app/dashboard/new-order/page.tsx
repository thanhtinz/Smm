import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import NewOrderForm from "@/components/orders/new-order-form";
import { Icon } from "@/components/icons";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t } = ctx;

  if (!(await getSetting("order.enabled"))) {
    return (
      <div className="alert alert-info mx-auto max-w-2xl" role="status">
        <Icon name="info" size={16} />
        <span>Ordering is temporarily disabled. Please try again later.</span>
      </div>
    );
  }

  const [platforms, categories, services] = await Promise.all([
    db.platform.findMany({ where: { visible: true }, orderBy: { position: "asc" } }),
    db.category.findMany({ where: { visible: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    db.service.findMany({ where: { enabled: true }, orderBy: [{ position: "asc" }, { rate: "asc" }] }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{t("dash.newOrder")}</h2>

      <NewOrderForm
        platforms={platforms.map((p) => ({ id: p.id, name: p.name, icon: p.icon, color: p.color }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, platformId: c.platformId }))}
        services={services.map((s) => ({
          id: s.id,
          publicId: s.publicId,
          name: s.name,
          categoryId: s.categoryId,
          rate: s.rate,
          min: s.min,
          max: s.max,
          refill: s.refill,
          averageTime: s.averageTime,
          description: s.description,
        }))}
        balance={user.balance}
        currency={{
          code: ctx.currency.code,
          symbol: ctx.currency.symbol,
          symbolBefore: ctx.currency.symbolBefore,
          decimals: ctx.currency.decimals,
          rate: ctx.currency.rate,
          locale: ctx.locale,
        }}
        labels={{
          platform: t("order.platform"),
          category: t("order.category"),
          service: t("order.service"),
          link: t("order.link"),
          quantity: t("order.quantity"),
          charge: t("order.charge"),
          submit: t("order.submit"),
          min: t("order.min"),
          max: t("order.max"),
          rate: t("order.rate"),
          balance: t("common.balance"),
          addFunds: t("dash.addFunds"),
          choose: t("order.selectPlatformFirst"),
          selectCategory: t("order.selectCategory"),
          selectService: t("order.selectService"),
          selectPlatformFirst: t("order.selectPlatformFirst"),
          selectCategoryFirst: t("order.selectCategoryFirst"),
          averageTime: t("order.averageTime"),
          refillLabel: t("order.refill"),
          yes: t("common.yes"),
          no: t("common.no"),
          placed: t("order.placed"),
          track: t("order.track"),
          insufficient: t("order.insufficient"),
        }}
      />
    </div>
  );
}
