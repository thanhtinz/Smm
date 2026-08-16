import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAppContext, readerMessages } from "@/lib/context";
import { getSettings } from "@/lib/settings";
import { Icon } from "@/components/icons";
import SettingsForm from "@/components/admin/settings-form";
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
 * The other sections stay in view as a row of links: an operator changing the
 * base currency often wants the language beside it, and making that two clicks
 * through the index would have traded one kind of tedium for another.
 */
export default async function AdminSettingGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const { t } = await getAppContext();

  const groups = settingGroups();
  if (!groups.includes(group)) notFound();

  const current = await getSettings();
  const fields = settingFields(group, t, current as Record<string, unknown>);
  const summary = groupSummary(group, t);

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

      <nav aria-label={t("admin.settings")} className="flex flex-wrap gap-1.5">
        {groups.map((other) => (
          <Link
            key={other}
            href={`/admin/settings/${other}`}
            aria-current={other === group ? "page" : undefined}
            className={`ring-focus rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
              other === group
                ? "bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] font-semibold text-[var(--primary)]"
                : "muted hover:text-[var(--text)]"
            }`}
          >
            {groupTitle(other, t)}
          </Link>
        ))}
      </nav>

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
    </div>
  );
}
