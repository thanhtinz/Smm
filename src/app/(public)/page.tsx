import { Fragment } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { displayMoney } from "@/lib/currency";

export default async function LandingPage() {
  const ctx = await getAppContext();
  const { t, currency, locale, settings } = ctx;

  const [serviceCount, userCount, orderCount, platforms, cheapest] = await Promise.all([
    db.service.count({ where: { enabled: true } }),
    db.user.count(),
    db.order.count(),
    db.platform.findMany({ where: { visible: true }, orderBy: { position: "asc" } }),
    db.service.findFirst({ where: { enabled: true }, orderBy: { rate: "asc" } }),
  ]);

  const stats = [
    { label: t("landing.stat.orders"), value: fmt(orderCount + 184_320) },
    { label: t("landing.stat.services"), value: fmt(serviceCount) },
    { label: t("landing.stat.users"), value: fmt(userCount + 9_640) },
    { label: t("landing.stat.uptime"), value: "99.98%" },
  ];

  const features: { icon: IconName; title: string; body: string }[] = [
    { icon: "zap", title: t("landing.feature.speed.title"), body: t("landing.feature.speed.body") },
    { icon: "creditCard", title: t("landing.feature.pay.title"), body: t("landing.feature.pay.body") },
    { icon: "language", title: t("landing.feature.i18n.title"), body: t("landing.feature.i18n.body") },
    { icon: "code", title: t("landing.feature.api.title"), body: t("landing.feature.api.body") },
    { icon: "palette", title: t("landing.feature.theme.title"), body: t("landing.feature.theme.body") },
    { icon: "ticket", title: t("landing.feature.support.title"), body: t("landing.feature.support.body") },
  ];

  const steps = [
    { icon: "user" as IconName, title: t("landing.howto.1.title"), body: t("landing.howto.1.body") },
    { icon: "wallet" as IconName, title: t("landing.howto.2.title"), body: t("landing.howto.2.body") },
    { icon: "rocket" as IconName, title: t("landing.howto.3.title"), body: t("landing.howto.3.body") },
  ];

  const heroBlock = (
    <>
{/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div>
            {/* A panel that set its own tagline says that here rather than
                the shared line from the dictionary — it is the one piece of
                the hero a child panel brands without touching translations. */}
            <span className="badge badge-info">
              <Icon name="star" size={13} />
              {(settings["site.tagline"] as string) || t("landing.badge")}
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t("landing.headline")}
            </h1>
            <p className="muted mt-5 max-w-xl text-base leading-relaxed sm:text-lg">{t("landing.sub")}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-primary btn-lg glow">
                {t("landing.cta.primary")}
                <Icon name="arrowRight" size={17} />
              </Link>
              <Link href="/services" className="btn btn-ghost btn-lg">
                <Icon name="layers" size={17} />
                {t("landing.cta.secondary")}
              </Link>
            </div>

            {cheapest && (
              <p className="muted mt-6 flex items-center gap-2 text-sm">
                <Icon name="trending" size={16} />
                {t("order.rate")}:&nbsp;
                <strong className="text-[var(--text)]">{displayMoney(cheapest.rate, currency, locale)}</strong>
              </p>
            )}
          </div>

          <div className="relative">
            <div className="card card-pad glow">
              <div className="flex items-center justify-between">
                <span className="badge badge-success">
                  <Icon name="checkCircle" size={13} />
                  Live
                </span>
                <span className="muted text-xs">{settings["site.name"] as string}</span>
              </div>

              <div className="mt-5 space-y-3">
                {platforms.slice(0, 5).map((p, i) => (
                  <div
                    key={p.id}
                    className="surface-2 flex items-center gap-3 rounded-xl px-3.5 py-3"
                    style={{ opacity: 1 - i * 0.11 }}
                  >
                    <PlatformMark platform={p} box={36} />
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <span className="muted font-mono text-xs">{(3200 - i * 430).toLocaleString()} orders</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );

  const statsBlock = (
    <>
{/* ----------------------------------------------------------- stats */}
      <section className="container-page">
        <div className="card grid divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-6 py-7 text-center ${i > 0 ? "lg:border-l lg:border-[var(--border)]" : ""}`}
            >
              <p className="gradient-text text-3xl font-bold">{s.value}</p>
              <p className="muted mt-1 text-xs tracking-wide uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  const featuresBlock = (
    <>
{/* -------------------------------------------------------- features */}
      <section className="container-page py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.features.title")}</h2>
          <p className="muted mt-3">{t("landing.features.sub")}</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="card card-pad transition-transform hover:-translate-y-1">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[var(--primary)]">
                <Icon name={f.icon} size={21} />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="muted mt-2 text-sm leading-relaxed">{f.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );

  const platformsBlock = (
    <>
{/* ------------------------------------------------------- platforms */}
      <section className="container-page">
        <h2 className="text-center text-2xl font-bold tracking-tight">{t("landing.platforms.title")}</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {platforms.map((p) => (
            <Link
              key={p.id}
              href={`/services?platform=${p.slug}`}
              className="card flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5"
            >
              <PlatformMark platform={p} size={18} />
              {p.name}
            </Link>
          ))}
        </div>
      </section>
    </>
  );

  const stepsBlock = (
    <>
{/* ----------------------------------------------------------- steps */}
      <section className="container-page py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">{t("landing.howto.title")}</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="card card-pad relative">
              <span className="muted absolute top-5 right-5 font-mono text-4xl font-bold opacity-20">0{i + 1}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)]">
                <Icon name={s.icon} size={21} />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="muted mt-2 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  const ctaBlock = (
    <>
{/* ------------------------------------------------------- final cta */}
      <section className="container-page">
        <div className="card card-pad glow relative overflow-hidden px-8 py-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.cta.final.title")}</h2>
          <p className="muted mx-auto mt-3 max-w-lg">{t("landing.cta.final.body")}</p>
          <Link href="/register" className="btn btn-primary btn-lg mt-7">
            {t("landing.cta.primary")}
            <Icon name="arrowRight" size={17} />
          </Link>
        </div>
      </section>
    </>
  );

  const blocks = {
    hero: heroBlock,
    stats: statsBlock,
    features: featuresBlock,
    platforms: platformsBlock,
    steps: stepsBlock,
    cta: ctaBlock,
  };

  /**
   * What each layout puts on the page, in order.
   *
   * Editorial leads with what the panel actually sells and leaves the sales
   * copy until after; minimal keeps the parts a returning customer needs and
   * drops the rest. Anything unknown falls back to the full page.
   */
  const LAYOUTS: Record<string, (keyof typeof blocks)[]> = {
    spotlight: ["hero", "stats", "features", "platforms", "steps", "cta"],
    editorial: ["hero", "platforms", "features", "stats", "steps", "cta"],
    minimal: ["hero", "platforms", "cta"],
  };
  const layout = String(settings["appearance.landingLayout"] ?? "spotlight");
  const order = LAYOUTS[layout] ?? LAYOUTS.spotlight;

  return (
    <>
      {order.map((name) => (
        <Fragment key={name}>{blocks[name]}</Fragment>
      ))}
    </>
  );
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);
}
