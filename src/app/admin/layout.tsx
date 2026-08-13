import { redirect } from "next/navigation";
import AppShell, { type NavGroup, type NavItem } from "@/components/app-shell";
import { getAppContext } from "@/lib/context";
import { guardPanel } from "@/lib/tenancy";
import PanelSuspended from "@/components/panel-suspended";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const panel = await guardPanel();
  if (panel.status !== "active") return <PanelSuspended name={panel.name} note={panel.statusNote} />;

  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");
  if (ctx.user.role !== "admin") redirect("/dashboard");

  const { t } = ctx;
  const isRoot = panel.parentId === null;
  const childPanelsOn = Boolean(await getSetting("panel.childrenEnabled"));
  const openRequests = await db.orderRequest.count({ where: { status: "pending" } });

  // A child panel buys from its parent and nowhere else, so it has no upstream
  // providers to configure. Its own catalogue is still its own to manage.
  const catalogue: NavItem[] = [
    { href: "/admin/platforms", label: t("admin.platforms"), icon: "globe" },
    { href: "/admin/categories", label: t("admin.categories"), icon: "layers" },
    { href: "/admin/services", label: t("admin.services"), icon: "package" },
    ...(isRoot ? [{ href: "/admin/providers", label: t("admin.providers"), icon: "server" } as NavItem] : []),
  ];

  // Languages, currencies and themes are one shared set; only the root panel
  // edits them. Every panel still picks its own defaults in Settings.
  const configuration: NavItem[] = [
    { href: "/admin/payment-methods", label: t("admin.paymentMethods"), icon: "wallet" },
    { href: "/admin/coupons", label: t("coupon.title"), icon: "gift" },
    ...(isRoot
      ? ([
          { href: "/admin/currencies", label: t("common.currency"), icon: "bank" },
          { href: "/admin/languages", label: t("common.language"), icon: "language" },
          { href: "/admin/appearance", label: t("common.appearance"), icon: "palette" },
        ] as NavItem[])
      : []),
    ...(childPanelsOn ? [{ href: "/admin/panels", label: t("panel.title"), icon: "layers" } as NavItem] : []),
    { href: "/admin/settings", label: t("admin.settings"), icon: "settings" },
  ];

  const groups: NavGroup[] = [
    {
      title: "Overview",
      items: [
        { href: "/admin", label: t("admin.overview"), icon: "chart", exact: true },
        { href: "/admin/statistics", label: t("admin.statistics"), icon: "trending" },
        { href: "/admin/logs", label: t("admin.logs"), icon: "list" },
      ],
    },
    {
      title: t("admin.catalogue"),
      items: catalogue,
    },
    {
      title: t("admin.operations"),
      items: [
        { href: "/admin/orders", label: t("dash.orders"), icon: "list" },
        { href: "/admin/requests", label: t("request.title"), icon: "refresh", badge: openRequests || undefined },
        { href: "/admin/transactions", label: t("wallet.history"), icon: "creditCard" },
        { href: "/admin/users", label: t("admin.users"), icon: "users" },
        { href: "/admin/tiers", label: t("tier.title"), icon: "trending" },
        { href: "/admin/tickets", label: t("dash.tickets"), icon: "ticket" },
        { href: "/admin/announcements", label: t("announcement.title"), icon: "megaphone" },
      ],
    },
    {
      title: t("admin.configuration"),
      items: configuration,
    },
    {
      title: t("nav.account"),
      items: [{ href: "/dashboard", label: t("dash.title"), icon: "dashboard", exact: true }],
    },
  ];

  const primaryMobile: NavItem[] = [
    { href: "/admin", label: t("admin.overview"), icon: "chart", exact: true },
    { href: "/admin/services", label: t("admin.services"), icon: "package" },
    { href: "/admin/orders", label: t("dash.orders"), icon: "list" },
    { href: "/admin/users", label: t("admin.users"), icon: "users" },
    { href: "/admin/settings", label: t("admin.settings"), icon: "settings" },
  ];

  return (
    <AppShell ctx={ctx} groups={groups} primaryMobile={primaryMobile} title={t("admin.title")}>
      {children}
    </AppShell>
  );
}
