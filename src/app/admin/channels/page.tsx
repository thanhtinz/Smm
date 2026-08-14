import type { Metadata } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { getAppContext } from "@/lib/context";
import { currentPanelId } from "@/lib/tenancy";
import ChannelManager from "@/components/admin/channel-manager";
import { DRIVERS, PLANNED_KINDS } from "@/lib/inbox/drivers";

export const metadata: Metadata = { title: "Channels" };

export default async function AdminChannelsPage() {
  const { t } = await getAppContext();

  const [rows, panel, head] = await Promise.all([
    db.channel.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { conversations: true } } },
    }),
    basePrisma.panel.findFirst({ where: { id: await currentPanelId() } }),
    headers(),
  ]);

  // The address a platform is pointed at has to be the one the operator's
  // customers reach, which is the host this page was served on.
  const proto = head.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${head.get("x-forwarded-host") ?? head.get("host") ?? ""}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("inbox.channels")}</h2>
        <p className="muted mt-2 text-sm">{t("inbox.channelsHint")}</p>
      </div>

      <ChannelManager
        rows={rows.map((c) => ({
          id: c.id,
          kind: c.kind,
          name: c.name,
          externalId: c.externalId,
          enabled: c.enabled,
          threads: c._count.conversations,
          webhook: `${origin}/api/webhooks/${panel?.webhookToken ?? ""}/inbox/${c.id}`,
        }))}
        kinds={Object.values(DRIVERS).map((d) => ({
          kind: d.kind,
          label: t(`inbox.kind.${d.kind}`),
          fields: d.fields.map((f) => ({ key: f.key, secret: f.secret })),
        }))}
        planned={PLANNED_KINDS.map((k) => t(`inbox.kind.${k}`))}
        labels={{
          connected: t("inbox.connected"),
          connect: t("inbox.connect"),
          none: t("inbox.noChannels"),
          platform: t("order.platform"),
          label: t("inbox.label"),
          labelHint: t("inbox.labelHint"),
          threads: t("inbox.threads"),
          on: t("admin.visible"),
          off: t("page.hidden"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          copy: t("common.copy"),
          copied: t("common.copied"),
          planned: t("inbox.planned"),
          plannedWhy: t("inbox.plannedWhy"),
          "field.token": t("inbox.field.token"),
          apiBase: t("inbox.apiBase"),
          apiBaseHint: t("inbox.apiBaseHint"),
        }}
      />
    </div>
  );
}
