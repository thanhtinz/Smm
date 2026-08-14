import { redirect } from "next/navigation";
import AppShell, { type NavGroup, type NavItem } from "@/components/app-shell";
import { getAppContext } from "@/lib/context";
import { guardPanel } from "@/lib/tenancy";
import PanelSuspended from "@/components/panel-suspended";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { headers } from "next/headers";
import { twoFactorRequired, STAFF_ROLES } from "@/lib/two-factor";
import { PATHNAME_HEADER } from "@/lib/panel-host";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const panel = await guardPanel();
  if (panel.status !== "active") return <PanelSuspended name={panel.name} note={panel.statusNote} />;

  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");
  if (!STAFF_ROLES.has(ctx.user.role)) redirect("/dashboard");

  // None of the 24 admin pages guards itself — they all rely on this layout —
  // so letting the support role in at all means saying exactly where it may
  // go. The support desk, and nothing else: settings, providers, payment
  // credentials and the user list stay with the admin.
  const isAdmin = ctx.user.role === "admin";
  const path = (await headers()).get(PATHNAME_HEADER) ?? "";
  if (!isAdmin && !path.startsWith("/admin/tickets")) redirect("/admin/tickets");

  // Enforced but not yet set up: the admin area stays closed until it is, and
  // the profile page is where the setup lives.
  if (!ctx.user.totpEnabledAt && (await twoFactorRequired())) redirect("/dashboard/profile");

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

  // Support only reaches the desk, so it is the only thing they are offered.
  // A nav full of links that redirect is worse than a short nav.
  const groups: NavGroup[] = isAdmin
    ? adminGroups()
    : [
        { title: t("admin.operations"), items: [{ href: "/admin/tickets", label: t("dash.tickets"), icon: "ticket" }] },
        { title: t("nav.account"), items: [{ href: "/dashboard", label: t("dash.title"), icon: "dashboard", exact: true }] },
      ];

  function adminGroups(): NavGroup[] {
    return [
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
        { href: "/admin/pages", label: t("page.title"), icon: "document" },
        { href: "/admin/landing", label: t("landing.admin.title"), icon: "layers" },
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
  }

  const primaryMobile: NavItem[] = isAdmin
    ? [
        { href: "/admin", label: t("admin.overview"), icon: "chart", exact: true },
        { href: "/admin/services", label: t("admin.services"), icon: "package" },
        { href: "/admin/orders", label: t("dash.orders"), icon: "list" },
        { href: "/admin/users", label: t("admin.users"), icon: "users" },
        { href: "/admin/settings", label: t("admin.settings"), icon: "settings" },
      ]
    : [
        { href: "/admin/tickets", label: t("dash.tickets"), icon: "ticket" },
        { href: "/dashboard", label: t("dash.title"), icon: "dashboard", exact: true },
      ];

  return (
    <AppShell ctx={ctx} groups={groups} primaryMobile={primaryMobile} title={t("admin.title")}>
      {children}
    </AppShell>
  );
}
