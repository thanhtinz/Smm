import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import { displayMoney } from "@/lib/currency";
import { requirePanel } from "@/lib/tenancy";
import { childrenOf, effectiveMaxDepth } from "@/lib/panels";
import PanelManager from "@/components/admin/panel-manager";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Child panels" };

export default async function AdminPanelsPage() {
  const { t, currency, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);
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

  // The standard price this panel charges; a child with its own price shows
  // that instead.
  const [standardRent, periodDays] = await Promise.all([
    getSetting("panel.rentPrice"),
    getSetting("panel.rentPeriodDays"),
  ]);
  const fmtDate = { format: dates.day };
  const today = new Date();
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
          rentPrice: c.rentPrice === null ? "" : String(c.rentPrice),
          rentLabel: (() => {
            const price = c.rentPrice ?? Number(standardRent) ?? 0;
            if (!price) return t("panel.rentFree");
            return `${displayMoney(price, currency, locale)} / ${Number(periodDays)}${t("panel.days")}`;
          })(),
          nextDueAt: c.nextDueAt ? c.nextDueAt.toISOString().slice(0, 10) : "",
          dueLabel: c.nextDueAt ? `${t("panel.nextDue")}: ${fmtDate.format(c.nextDueAt)}` : "",
          overdue: Boolean(c.nextDueAt && c.nextDueAt < today),
          users: c.users,
          orders: c.orders,
          earned: displayMoney(c.wholesale + c.rent, currency, locale),
          services: c.services,
          domains: c.domains.map((d) => ({
            id: d.id,
            host: d.host,
            verified: d.verified,
            isPrimary: d.isPrimary,
            verifyToken: d.verifyToken,
            managed: d.dnsRecordId !== "",
          })),
        }))}
        labels={{
          close: t("common.close"),
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
          dnsManaged: t("panel.dnsManaged"),
          unverified: t("panel.unverified"),
          owner: t("panel.owner"),
          rent: t("panel.rent"),
          rentPrice: t("panel.rentPrice"),
          rentHint: t("panel.rentHint"),
          nextDue: t("panel.nextDue"),
          users: t("admin.users"),
          orders: t("dash.orders"),
          earned: t("panel.earned"),
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
          "status.expired": t("panel.status.expired"),
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
