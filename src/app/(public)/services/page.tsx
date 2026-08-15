import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { priceServices, resolveTier } from "@/lib/pricing";
import { Icon, type IconName } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import CategoryList from "@/components/services/category-list";
import { serviceListLabels } from "@/lib/service-list";
import ServiceSearch from "@/components/services/service-search";

/**
 * Filtering here is for someone already on the site. The address that owns a
 * platform's content is /services/<slug>, so the filtered view points at it
 * rather than competing with it for the same words.
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const { platform } = await searchParams;
  const { t } = await getAppContext();
  return {
    title: t("nav.services"),
    alternates: { canonical: platform ? `/services/${platform}` : "/services" },
  };
}

type Search = { platform?: string; category?: string; q?: string };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const { t, currency, locale } = ctx;

  const platforms = await db.platform.findMany({
    where: { visible: true },
    orderBy: { position: "asc" },
  });

  const activePlatform = platforms.find((p) => p.slug === params.platform);
  const query = (params.q ?? "").trim();

  const categories = await db.category.findMany({
    where: {
      visible: true,
      ...(activePlatform ? { platformId: activePlatform.id } : {}),
      // The catalogue landing links a category directly, so arriving that way
      // opens on that one rather than on the whole platform.
      ...(params.category ? { id: params.category } : {}),
      services: { some: { enabled: true, ...(query ? { name: { contains: query } } : {}) } },
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      platform: true,
      services: {
        where: { enabled: true, ...(query ? { name: { contains: query } } : {}) },
        orderBy: [{ position: "asc" }, { rate: "asc" }],
      },
    },
  });

  // Signed-out visitors see the starting tier's prices, which is what they
  // would pay if they registered right now.
  const tier = await resolveTier(ctx.user);
  const rates = await priceServices(tier, categories.flatMap((c) => c.services));
  const rateOf = (id: string, fallback: number) => rates.get(id) ?? fallback;

  const total = categories.reduce((n, c) => n + c.services.length, 0);

  return (
    <div className="container-page py-12">
      <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">{t("nav.services")}</h1>

      {/* Signed in only: the file is priced for whoever downloads it, and a
          visitor has no tier to price it for. */}
      {ctx.user && (
        <div className="mt-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              this is a file, not a page: <Link> would client-navigate to the
              route and nothing would ever download. */}
          <a href="/api/export/services" className="btn btn-ghost btn-sm">
            <Icon name="download" size={15} />
            {t("common.export")}
          </a>
        </div>
      )}

      {/* --------------------------------------------------------- filters */}
      <div className="mt-9 space-y-4">
        <ServiceSearch placeholder={t("common.search")} defaultValue={query} />

        <div className="scroll-x -mx-1 px-1">
          <div className="flex gap-2 pb-1">
            <FilterChip href={buildHref({ q: query })} active={!activePlatform} icon="layers" label={t("common.all")} />
            {platforms.map((p) => (
              <FilterChip
                key={p.id}
                href={buildHref({ q: query, platform: p.slug })}
                active={activePlatform?.id === p.id}
                platform={p}
                label={p.name}
              />
            ))}
          </div>
        </div>

        <p className="muted text-sm" aria-live="polite">
          {total} {t("nav.services").toLowerCase()}
        </p>
      </div>

      {/* -------------------------------------------------------- listings */}
      {categories.length === 0 ? (
        <div className="card card-pad mt-8 py-16 text-center">
          <span className="muted inline-flex">
            <Icon name="search" size={32} />
          </span>
          <p className="muted mt-3">{t("common.none")}</p>
          <Link href="/services" className="btn btn-ghost btn-sm mt-4">
            <Icon name="refresh" size={15} />
            {t("common.all")}
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <CategoryList
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              // Its own address, which is the one that ranks: this filtered
              // view is for somebody already here.
              href: c.platform ? `/services/${c.platform.slug}/${c.slug}` : undefined,
              description: c.description,
              platform: c.platform,
              services: c.services.map((sv) => ({
                id: sv.id,
                publicId: sv.publicId,
                name: sv.name,
                rate: rateOf(sv.id, sv.rate),
                min: sv.min,
                max: sv.max,
                refill: sv.refill,
                averageTime: sv.averageTime,
              })),
            }))}
            currency={currency}
            locale={locale}
            labels={serviceListLabels(t)}
          />
        </div>
      )}

    </div>
  );
}

function buildHref(params: { q?: string; platform?: string }) {
  // With no search running, a platform chip goes to that platform's own page.
  // Mid-search it has to stay on the filter, because the platform page has no
  // search of its own to carry the term into.
  if (params.platform && !params.q) return `/services/${params.platform}`;

  const sp = new URLSearchParams();
  if (params.platform) sp.set("platform", params.platform);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/services?${qs}` : "/services";
}

function FilterChip({
  href,
  active,
  icon,
  platform,
  label,
}: {
  href: string;
  active: boolean;
  icon?: IconName;
  platform?: { name: string; icon: string; image: string; color: string };
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
          : "muted border-[var(--border)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      }`}
    >
      {platform ? <PlatformMark platform={platform} size={16} /> : icon ? <Icon name={icon} size={16} /> : null}
      {label}
    </Link>
  );
}
