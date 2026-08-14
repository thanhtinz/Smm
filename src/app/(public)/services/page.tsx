import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { displayMoney } from "@/lib/currency";
import { priceServices, resolveTier } from "@/lib/pricing";
import { Icon, type IconName } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import ServiceSearch from "@/components/services/service-search";

export const metadata: Metadata = { title: "Services" };

type Search = { platform?: string; q?: string };

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
        <div className="mt-8 space-y-6">
          {categories.map((category) => (
            <section key={category.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-4">
                {category.platform && (
                  <PlatformMark platform={category.platform} box={36} />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{category.name}</h2>
                  {category.description && <p className="muted truncate text-xs">{category.description}</p>}
                </div>
                <span className="badge badge-muted">{category.services.length}</span>
              </header>

              {/* Table on wide screens; the same rows become cards below md so
                  the page never scrolls sideways. */}
              <div className="scroll-x hidden md:block">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-20">ID</th>
                      <th>{t("order.service")}</th>
                      <th className="w-40 text-right">{t("order.rate")}</th>
                      <th className="w-24 text-right">{t("order.min")}</th>
                      <th className="w-28 text-right">{t("order.max")}</th>
                      <th className="w-28">{t("common.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.services.map((s) => (
                      <tr key={s.id}>
                        <td className="muted font-mono text-xs">{s.publicId}</td>
                        <td>
                          <span className="font-medium">{s.name}</span>
                          {s.averageTime && (
                            <span className="muted mt-0.5 flex items-center gap-1 text-xs">
                              <Icon name="clock" size={12} />
                              {s.averageTime}
                            </span>
                          )}
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {displayMoney(rateOf(s.id, s.rate), currency, locale)}
                        </td>
                        <td className="muted text-right tabular-nums">{s.min.toLocaleString()}</td>
                        <td className="muted text-right tabular-nums">{s.max.toLocaleString()}</td>
                        <td>
                          {s.refill ? (
                            <span className="badge badge-success">
                              <Icon name="refresh" size={12} />
                              Refill
                            </span>
                          ) : (
                            <span className="badge badge-muted">
                              <Icon name="zap" size={12} />
                              Standard
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[var(--border)] md:hidden">
                {category.services.map((s) => (
                  <li key={s.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{s.name}</p>
                      <span className="muted shrink-0 font-mono text-xs">{s.publicId}</span>
                    </div>
                    <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                      <Cell label={t("order.rate")} value={displayMoney(rateOf(s.id, s.rate), currency, locale)} strong />
                      <Cell label={t("order.min")} value={s.min.toLocaleString()} />
                      <Cell label={t("order.max")} value={s.max.toLocaleString()} />
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

    </div>
  );
}

function buildHref(params: { q?: string; platform?: string }) {
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

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="muted text-[0.65rem] tracking-wide uppercase">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : "muted"}`}>{value}</dd>
    </div>
  );
}
