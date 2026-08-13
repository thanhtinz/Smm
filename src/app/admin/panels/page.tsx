import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { requirePanel } from "@/lib/tenancy";
import { childrenOf, effectiveMaxDepth } from "@/lib/panels";
import PanelManager from "@/components/admin/panel-manager";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Child panels" };

export default async function AdminPanelsPage() {
  const { t } = await getAppContext();
  const panel = await requirePanel();

  const [enabled, maxDepth, maxChildren] = await Promise.all([
    getSetting("panel.childrenEnabled"),
    effectiveMaxDepth(panel),
    getSetting("panel.maxChildren"),
  ]);

  if (!enabled) {
    return (
      <div className="alert alert-info mx-auto max-w-2xl" role="status">
        <Icon name="info" size={16} />
        <span>{t("panel.disabled")}</span>
      </div>
    );
  }

  const children = await childrenOf(panel);
  const owners = await db.user.findMany({
    where: { banned: false },
    orderBy: { username: "asc" },
    select: { id: true, username: true, email: true },
    take: 500,
  });
  const ownerName = new Map(owners.map((o) => [o.id, o.username]));

  const depthReached = Number(maxDepth) > 0 && panel.depth + 1 > Number(maxDepth);
  const countReached = Number(maxChildren) > 0 && children.length >= Number(maxChildren);

  const limitNote = depthReached
    ? t("panel.limitDepth", { max: Number(maxDepth) })
    : countReached
      ? t("panel.limitCount", { max: Number(maxChildren) })
      : "";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PanelManager
        canCreate={!depthReached && !countReached}
        limitNote={limitNote}
        owners={owners.map((o) => ({ id: o.id, label: `${o.username} · ${o.email}` }))}
        rows={children.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          depth: c.depth,
          status: c.status,
          statusNote: c.statusNote,
          ownerName: ownerName.get(c.ownerUserId) ?? "—",
          users: c.users,
          orders: c.orders,
          services: c.services,
          domains: c.domains.map((d) => ({
            id: d.id,
            host: d.host,
            verified: d.verified,
            isPrimary: d.isPrimary,
            verifyToken: d.verifyToken,
          })),
        }))}
        labels={{
          title: t("panel.title"),
          new: t("panel.new"),
          create: t("panel.create"),
          empty: t("panel.empty"),
          panel: t("panel.panel"),
          level: t("panel.level"),
          domain: t("panel.domain"),
          domains: t("panel.domains"),
          addDomain: t("panel.addDomain"),
          verify: t("panel.verify"),
          verified: t("panel.verified"),
          unverified: t("panel.unverified"),
          owner: t("panel.owner"),
          users: t("admin.users"),
          orders: t("dash.orders"),
          suspend: t("panel.suspend"),
          resume: t("panel.resume"),
          resetAdmin: t("panel.resetAdmin"),
          adminUsername: t("auth.username"),
          adminEmail: t("auth.email"),
          adminPassword: t("auth.password"),
          name: t("admin.name"),
          slug: t("admin.slug"),
          status: t("common.status"),
          "status.active": t("panel.status.active"),
          "status.suspended": t("panel.status.suspended"),
          remove: t("admin.delete"),
          copy: t("wallet.copy"),
          copied: t("wallet.copied"),
          save: t("common.save"),
          saved: t("admin.saved"),
        }}
      />
    </div>
  );
}
