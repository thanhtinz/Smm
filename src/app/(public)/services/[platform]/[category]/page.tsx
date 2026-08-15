import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { priceServices, resolveTier } from "@/lib/pricing";
import { displayMoney } from "@/lib/currency";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import CategoryList from "@/components/services/category-list";
import { serviceListLabels } from "@/lib/service-list";
import NewOrderForm, { type Currency, type ServiceOption } from "@/components/orders/new-order-form";
import { orderFormLabels } from "@/lib/order-form-labels";
import { toServiceOption } from "@/lib/service-option";
import { serviceStatsMany } from "@/lib/service-stats";
import { LINK_RULES } from "@/lib/links";

/**
 * One category, one address, and the order form on it.
 *
 * This is how this market shops: the menu is a platform, the platform opens
 * onto its categories, and a category is a page you buy from — not a filter
 * applied to a bigger list. The two questions the cascade would ask here have
 * already been answered by the act of arriving, so the form drops them and
 * opens at the one that still matters: which service.
 *
 * The form itself is the same component the dashboard uses, not a copy. There
 * is one order form in this panel, with one set of limits, one price
 * calculation and one balance check; a second one that looked the same would
 * only be the same until the first time one of them changed.
 */
export const dynamic = "force-dynamic";

async function load(platformSlug: string, categorySlug: string) {
  return db.category.findFirst({
    where: {
      slug: categorySlug,
      visible: true,
      platform: { slug: platformSlug, visible: true },
    },
    include: {
      platform: { select: { ...LINK_RULES, id: true, slug: true, name: true, icon: true, image: true, color: true } },
      services: {
        where: { enabled: true },
        orderBy: [{ position: "asc" }, { rate: "asc" }],
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string; category: string }>;
}): Promise<Metadata> {
  const { platform, category: slug } = await params;
  const category = await load(platform, slug);
  if (!category) return { title: "Not found" };

  return {
    title: `${category.name} — ${category.platform?.name ?? ""}`.trim(),
    ...(category.description ? { description: category.description } : {}),
    alternates: { canonical: `/services/${platform}/${slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ platform: string; category: string }>;
}) {
  const { platform: platformSlug, category: slug } = await params;
  const ctx = await getAppContext();
  const { t, currency, locale, user } = ctx;

  const category = await load(platformSlug, slug);
  if (!category || !category.platform) notFound();
  const platform = category.platform;

  // Prices are per customer: a signed-in reseller on a tier sees their rate
  // here, and the same rate again on the form below. Two different numbers on
  // one page would be the panel arguing with itself.
  const tier = await resolveTier(user);
  const rates = await priceServices(tier, category.services);
  const rateOf = (id: string, fallback: number) => rates.get(id) ?? fallback;
  const cheapest = category.services.length
    ? Math.min(...category.services.map((s) => rateOf(s.id, s.rate)))
    : 0;

  const ordering = user !== null && (await getSetting("order.enabled"));

  const measured = await serviceStatsMany(category.services.map((s) => s.id));
  const serviceOptions: ServiceOption[] = category.services.map((s) =>
    toServiceOption(s, { rate: rateOf(s.id, s.rate), links: platform, stats: measured.get(s.id), t }),
  );

  const money: Currency = {
    code: currency.code,
    symbol: currency.symbol,
    symbolBefore: currency.symbolBefore,
    decimals: currency.decimals,
    rate: currency.rate,
    locale,
  };

  const priceList = (
    <CategoryList
      categories={[
        {
          id: category.id,
          name: category.name,
          description: "",
          platform: null,
          services: category.services.map((s) => ({
            id: s.id,
            publicId: s.publicId,
            name: s.name,
            rate: rateOf(s.id, s.rate),
            min: s.min,
            max: s.max,
            refill: s.refill,
            averageTime: s.averageTime,
          })),
        },
      ]}
      currency={currency}
      locale={locale}
      labels={serviceListLabels(t)}
      showPlatform={false}
    />
  );

  return (
    <div className="container-page py-12">
      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label={t("nav.services")}>
        <Link href="/services" className="muted hover:text-[var(--text)]">
          {t("nav.services")}
        </Link>
        <Icon name="chevronRight" size={14} className="muted" />
        <Link href={`/services/${platform.slug}`} className="muted hover:text-[var(--text)]">
          {platform.name}
        </Link>
      </nav>

      <header className="mt-5 flex flex-wrap items-center gap-4">
        <PlatformMark platform={platform} box={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[2rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-4xl">{category.name}</h1>
          {category.description && <p className="muted mt-2 max-w-2xl leading-relaxed">{category.description}</p>}
        </div>
        {cheapest > 0 && (
          <p className="shrink-0 text-right">
            <span className="muted block text-xs font-semibold tracking-[0.16em] uppercase">
              {t("landing.board.from")}
            </span>
            <span className="font-mono text-3xl font-bold text-[var(--primary)]">
              {displayMoney(cheapest, currency, locale)}
            </span>
            <span className="muted block text-xs">{t("landing.board.per")}</span>
          </p>
        )}
      </header>

      {ordering ? (
        // Form first, then the prices. The form is what somebody who already
        // knows the service came for; the table is how everybody else decides
        // which one, and it is the same table the signed-out page shows.
        <div className="mt-9 max-w-5xl space-y-8">
          <NewOrderForm
            platforms={[{ id: platform.id, name: platform.name, icon: platform.icon, image: platform.image, color: platform.color }]}
            categories={[{ id: category.id, name: category.name, platformId: platform.id }]}
            services={serviceOptions}
            balance={user!.balance}
            currency={money}
            locked
            labels={orderFormLabels(t)}
          />

          {priceList}
        </div>
      ) : (
        // Signed out, the page is still the page: the prices are the reason
        // anybody arrives here from a search, and hiding them behind a login
        // would answer a question nobody had yet.
        <div className="mt-9 space-y-6">
          <div className="alert alert-info" role="status">
            <Icon name="info" size={16} />
            <span>{user ? t("order.disabled") : t("services.signInToOrder")}</span>
          </div>

          {priceList}

          {!user && (
            <div className="flex flex-wrap gap-2">
              <Link href="/login" className="btn btn-primary btn-lg">
                {t("nav.signin")}
                <Icon name="arrowRight" size={17} />
              </Link>
              <Link href="/register" className="btn btn-ghost btn-lg">
                {t("nav.signup")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
