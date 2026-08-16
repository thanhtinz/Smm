import Link from "next/link";
import { pageTitle } from "@/lib/page-title";
import { getAppContext } from "@/lib/context";
import { Icon } from "@/components/icons";
import { groupSummary, groupTitle, settingBands, settingCount } from "@/lib/setting-groups";

export const generateMetadata = pageTitle("admin.settings");

/**
 * Where the settings start.
 *
 * Every one of the hundred and eighteen used to be on this page at once, two
 * columns of thirteen forms in registry order. Finding the minimum deposit
 * meant scrolling past the SMTP server. This is a table of contents instead:
 * the sections in the order an operator thinks about them, each saying what it
 * holds and how much of it there is, so the scrolling is over names rather
 * than over fields.
 */
export default async function AdminSettingsPage() {
  const { t } = await getAppContext();
  const bands = settingBands();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h2 className="text-2xl font-bold tracking-tight">{t("admin.settings")}</h2>

      {bands.map((band) => (
        <section key={band.key} className="space-y-3">
          <h3 className="muted text-[0.68rem] font-semibold tracking-widest uppercase">
            {t(`settingBand.${band.key}`)}
          </h3>

          <ul className="grid gap-3 sm:grid-cols-2">
            {band.groups.map((group) => {
              const summary = groupSummary(group, t);
              return (
                <li key={group}>
                  <Link
                    href={`/admin/settings/${group}`}
                    className="ring-focus card card-pad group flex h-full items-start gap-3 transition-colors hover:border-[var(--primary)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="font-semibold">{groupTitle(group, t)}</span>
                        <span className="muted font-mono text-xs tabular-nums">{settingCount(group)}</span>
                      </span>
                      {summary && <span className="muted mt-1 block text-sm leading-relaxed">{summary}</span>}
                    </span>
                    {/* No nudge on hover: `translate-x` is a physical
                        direction and would push the arrow backwards on a
                        right-to-left page. */}
                    <span className="muted mt-0.5 shrink-0 transition-colors group-hover:text-[var(--primary)]">
                      <Icon name="arrowRight" size={16} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
