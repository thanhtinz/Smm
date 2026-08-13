import Link from "next/link";
import Logo from "@/components/logo";
import PreferenceMenu from "@/components/preference-menu";
import { Icon, type IconName } from "@/components/icons";
import { getAppContext } from "@/lib/context";
import { guardPanel } from "@/lib/tenancy";
import PanelSuspended from "@/components/panel-suspended";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const panel = await guardPanel();
  if (panel.status !== "active") return <PanelSuspended name={panel.name} note={panel.statusNote} />;

  const ctx = await getAppContext();

  const { t, settings } = ctx;
  const points: { icon: IconName; text: string }[] = [
    { icon: "zap", text: t("landing.feature.speed.title") },
    { icon: "creditCard", text: t("landing.feature.pay.title") },
    { icon: "code", text: t("landing.feature.api.title") },
    { icon: "ticket", text: t("landing.feature.support.title") },
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      {/* ------------------------------------------------------- form side */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Link href="/" className="ring-focus rounded-lg">
            <Logo text={settings["site.logoText"] as string} size={30} />
          </Link>
          <PreferenceMenu
            languages={ctx.languages}
            currencies={ctx.currencies}
            themes={ctx.themes}
            locale={ctx.locale}
            currency={ctx.currency.code}
            theme={ctx.theme}
            mode={ctx.mode}
            showTheme={false}
          />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <p className="muted px-6 py-6 text-center text-xs sm:px-10">
          &copy; {new Date().getFullYear()} {settings["site.name"] as string}
        </p>
      </div>

      {/* ------------------------------------------------------ brand side */}
      <aside className="relative hidden overflow-hidden border-l border-[var(--border)] lg:flex lg:flex-col lg:justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 420px at 70% 20%, color-mix(in srgb, var(--primary) 26%, transparent), transparent), radial-gradient(600px 400px at 20% 85%, color-mix(in srgb, var(--accent) 20%, transparent), transparent)",
          }}
        />
        <div className="relative px-14 xl:px-20">
          <h2 className="max-w-md text-3xl leading-tight font-bold tracking-tight xl:text-4xl">
            {t("landing.headline")}
          </h2>
          <p className="muted mt-4 max-w-md leading-relaxed">{t("landing.sub")}</p>

          <ul className="mt-9 space-y-3.5">
            {points.map((p) => (
              <li key={p.text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] text-[var(--primary)]">
                  <Icon name={p.icon} size={17} />
                </span>
                <span className="text-sm font-medium">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
