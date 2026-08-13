import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import NewOrderForm, { type Currency, type ServiceOption } from "@/components/orders/new-order-form";
import MassOrderForm from "@/components/orders/mass-order-form";
import OrderTabs from "@/components/orders/order-tabs";
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

  const serviceOptions: ServiceOption[] = services.map((s) => ({
    id: s.id,
    publicId: s.publicId,
    name: s.name,
    categoryId: s.categoryId,
    rate: s.rate,
    min: s.min,
    max: s.max,
    refill: s.refill,
    cancel: s.cancel,
    dripfeed: s.dripfeed,
    averageTime: s.averageTime,
    description: s.description,
  }));

  const currency: Currency = {
    code: ctx.currency.code,
    symbol: ctx.currency.symbol,
    symbolBefore: ctx.currency.symbolBefore,
    decimals: ctx.currency.decimals,
    rate: ctx.currency.rate,
    locale: ctx.locale,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("dash.newOrder")}</h2>

      <OrderTabs
        tabs={[
          { key: "single", label: t("order.single"), icon: "cart" },
          { key: "mass", label: t("order.mass"), icon: "layers" },
        ]}
      >
        {{
          single: (
            <NewOrderForm
              platforms={platforms.map((p) => ({ id: p.id, name: p.name, icon: p.icon, color: p.color }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name, platformId: c.platformId }))}
              services={serviceOptions}
              balance={user.balance}
              currency={currency}
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
                selectCategory: t("order.selectCategory"),
                selectService: t("order.selectService"),
                selectPlatformFirst: t("order.selectPlatformFirst"),
                selectCategoryFirst: t("order.selectCategoryFirst"),
                searchService: t("common.search"),
                noResults: t("common.none"),
                averageTime: t("order.averageTime"),
                refillLabel: t("order.refill"),
                cancelLabel: t("order.cancel"),
                yes: t("common.yes"),
                no: t("common.no"),
                placed: t("order.placed"),
                track: t("order.track"),
                insufficient: t("order.insufficient"),
                dripfeed: t("order.dripfeed"),
                runs: t("order.runs"),
                interval: t("order.interval"),
                intervalHint: t("order.intervalHint"),
                total: t("order.totalQuantity"),
              }}
            />
          ),
          mass: (
            <MassOrderForm
              services={serviceOptions}
              balance={user.balance}
              currency={currency}
              labels={{
                title: t("order.massTitle"),
                format: t("order.massFormat"),
                submit: t("order.massSubmit"),
                lines: t("order.massLines"),
                estimated: t("order.massEstimated"),
                balance: t("common.balance"),
                placed: t("order.massPlaced"),
                failed: t("order.massFailed"),
                line: t("order.massLine"),
              }}
            />
          ),
        }}
      </OrderTabs>
    </div>
  );
}
