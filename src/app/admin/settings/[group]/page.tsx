import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAppContext, readerMessages } from "@/lib/context";
import { getSettings } from "@/lib/settings";
import { Icon } from "@/components/icons";
import SettingsForm from "@/components/admin/settings-form";
import PlatformServicesToggles from "@/components/admin/platform-services-toggles";
import { db } from "@/lib/db";
import { groupSummary, groupTitle, settingFields, settingGroups } from "@/lib/setting-groups";

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }): Promise<Metadata> {
  const { group } = await params;
  const t = await readerMessages();
  // The section's own name, so a tab left open says which one it is.
  return { title: settingGroups().includes(group) ? groupTitle(group, t) : t("admin.settings") };
}

/**
 * One section of the settings.
 *
 * The other sections are in the sidebar, under Settings, which is where a page
 * belongs — a row of tabs inside the page would have been a second navigation
 * for the same thing. So this is the section and nothing else.
 */
export default async function AdminSettingGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const { t } = await getAppContext();

  const groups = settingGroups();
  if (!groups.includes(group)) notFound();

  const current = await getSettings();
  const fields = settingFields(group, t, current as Record<string, unknown>);
  const summary = groupSummary(group, t);

  // The features section carries one thing the registry cannot hold: a switch
  // per platform, and platforms are rows an operator adds rather than keys
  // written at build time.
  const platforms =
    group === "features"
      ? await db.platform.findMany({
          orderBy: [{ position: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            icon: true,
            image: true,
            color: true,
            showServices: true,
            categories: { select: { id: true } },
          },
        })
      : [];

  // What each platform actually has on sale, so a switch is not thrown blind.
  // Grouped once rather than counted per platform: the page is a settings page,
  // not a report.
  const perCategory = new Map(
    (group === "features"
      ? await db.service.groupBy({ by: ["categoryId"], where: { enabled: true }, _count: { _all: true } })
      : []
    ).map((r) => [r.categoryId, r._count._all]),
  );
  const serviceCounts = new Map(
    platforms.map((p) => [p.id, p.categories.reduce((sum, c) => sum + (perCategory.get(c.id) ?? 0), 0)]),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin/settings" className="muted ring-focus inline-flex items-center gap-1.5 rounded-lg text-sm">
          <Icon name="arrowLeft" size={14} />
          {t("admin.settings")}
        </Link>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">{groupTitle(group, t)}</h2>
        {summary && <p className="muted mt-1 text-sm leading-relaxed">{summary}</p>}
      </div>

      <SettingsForm
        group={group}
        title=""
        fields={fields}
        labels={{
          save: t("common.save"),
          saved: t("admin.saved"),
          perLine: t("admin.onePerLine"),
          json: t("admin.jsonValue"),
        }}
      />

      {group === "features" && (
        <PlatformServicesToggles
          rows={platforms.map((p) => ({
            id: p.id,
            name: p.name,
            icon: p.icon,
            image: p.image,
            color: p.color,
            showServices: p.showServices,
            services: t("features.platformServices", { n: serviceCounts.get(p.id) ?? 0 }),
          }))}
          labels={{
            title: t("features.platforms"),
            summary: t("features.platformsSub"),
            empty: t("features.noPlatforms"),
            on: t("admin.enabled"),
            off: t("admin.disabled"),
          }}
        />
      )}
    </div>
  );
}
