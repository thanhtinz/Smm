import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { priceServices, resolveTier } from "@/lib/pricing";
import { displayMoney } from "@/lib/currency";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import CategoryList from "@/components/services/category-list";
import { serviceListLabels } from "@/lib/service-list";

/**
 * One platform, one address.
 *
 * The catalogue filters by query string, which is fine for someone already on
 * the site and useless to someone searching "buff follow tiktok giá rẻ" — a
 * query parameter has no title, no heading and nothing of its own to rank on.
 * This page has all three, and the words are the operator's: two panels
 * selling TikTok follows are competing for the same search, and generated
 * copy would leave them identical.
 */
export const dynamic = "force-dynamic";

async function load(slug: string) {
  return db.platform.findFirst({
    where: { slug, visible: true },
    include: {
      categories: {
        where: { visible: true, services: { some: { enabled: true } } },
        orderBy: [{ position: "asc" }, { name: "asc" }],
        include: { services: { where: { enabled: true }, orderBy: [{ position: "asc" }, { rate: "asc" }] } },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ platform: string }> }): Promise<Metadata> {
  const { platform: slug } = await params;
  const platform = await load(slug);
  if (!platform) return { title: "Not found" };

  return {
    title: platform.seoTitle || platform.name,
    ...(platform.seoDescription ? { description: platform.seoDescription } : {}),
    alternates: { canonical: `/services/${platform.slug}` },
  };
}

export default async function PlatformPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform: slug } = await params;
  const ctx = await getAppContext();
  const { t, currency, locale } = ctx;

  const platform = await load(slug);
  if (!platform) notFound();

  const services = platform.categories.flatMap((c) => c.services);
  const rates = await priceServices(await resolveTier(ctx.user), services);
  const rateOf = (id: string, fallback: number) => rates.get(id) ?? fallback;
  const cheapest = services.length ? Math.min(...services.map((s) => rateOf(s.id, s.rate))) : 0;

  return (
    <div className="container-page py-12">
      <Link href="/services" className="btn btn-ghost btn-sm">
        <Icon name="chevronLeft" size={15} />
        {t("nav.services")}
      </Link>

      <header className="mt-6 flex flex-wrap items-center gap-4">
        <PlatformMark platform={platform} box={56} />
        <div className="min-w-0 flex-1">
          {/* The heading is the operator's title when they wrote one, because
              "Instagram" is not what anybody searches for. */}
          <h1 className="text-[2rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-4xl">
            {platform.seoTitle || platform.name}
          </h1>
          {platform.seoDescription && (
            <p className="muted mt-2 max-w-2xl leading-relaxed">{platform.seoDescription}</p>
          )}
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

      <div className="mt-9">
        <CategoryList
          categories={platform.categories.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            platform: null,
            services: c.services.map((s) => ({
              id: s.id,
              publicId: s.publicId,
              name: s.name,
              rate: rateOf(s.id, s.rate),
              min: s.min,
              max: s.max,
              refill: s.refill,
              averageTime: s.averageTime,
            })),
          }))}
          currency={currency}
          locale={locale}
          labels={serviceListLabels(t)}
          showPlatform={false}
        />
      </div>

      {/* The operator's own copy, below the prices. Above them it would be a
          wall of text between a visitor and the number they came for. */}
      {platform.seoBody && (
        <div className="prose-page mt-10 max-w-3xl" dangerouslySetInnerHTML={{ __html: platform.seoBody }} />
      )}

      <div className="mt-10 flex flex-wrap gap-2">
        <Link href="/register" className="btn btn-primary btn-lg">
          {t("landing.cta.primary")}
          <Icon name="arrowRight" size={17} />
        </Link>
      </div>
    </div>
  );
}
