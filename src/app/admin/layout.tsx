import { redirect } from "next/navigation";
import AppShell, { type NavGroup, type NavItem } from "@/components/app-shell";
import { getAppContext } from "@/lib/context";
import { db } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");
  if (ctx.user.role !== "admin") redirect("/dashboard");

  const { t } = ctx;
  const openRequests = await db.orderRequest.count({ where: { status: "pending" } });

  const groups: NavGroup[] = [
    {
      title: "Overview",
      items: [{ href: "/admin", label: t("admin.overview"), icon: "chart", exact: true }],
    },
    {
      title: t("admin.catalogue"),
      items: [
        { href: "/admin/platforms", label: t("admin.platforms"), icon: "globe" },
        { href: "/admin/categories", label: t("admin.categories"), icon: "layers" },
        { href: "/admin/services", label: t("admin.services"), icon: "package" },
        { href: "/admin/providers", label: t("admin.providers"), icon: "server" },
      ],
    },
    {
      title: t("admin.operations"),
      items: [
        { href: "/admin/orders", label: t("dash.orders"), icon: "list" },
        { href: "/admin/requests", label: t("request.title"), icon: "refresh", badge: openRequests || undefined },
        { href: "/admin/transactions", label: t("wallet.history"), icon: "creditCard" },
        { href: "/admin/users", label: t("admin.users"), icon: "users" },
        { href: "/admin/tickets", label: t("dash.tickets"), icon: "ticket" },
      ],
    },
    {
      title: t("admin.configuration"),
      items: [
        { href: "/admin/payment-methods", label: t("admin.paymentMethods"), icon: "wallet" },
        { href: "/admin/currencies", label: t("common.currency"), icon: "bank" },
        { href: "/admin/languages", label: t("common.language"), icon: "language" },
        { href: "/admin/appearance", label: t("common.appearance"), icon: "palette" },
        { href: "/admin/settings", label: t("admin.settings"), icon: "settings" },
      ],
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
