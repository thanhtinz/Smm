import { redirect } from "next/navigation";
import AppShell, { type NavGroup, type NavItem } from "@/components/app-shell";
import { getAppContext } from "@/lib/context";
import { guardPanel } from "@/lib/tenancy";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await guardPanel();
  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");

  const { t } = ctx;
  const openTickets = await db.ticket.count({
    where: { userId: ctx.user.id, status: { in: ["open", "answered"] } },
  });

  const groups: NavGroup[] = [
    {
      title: t("dash.title"),
      items: [
        { href: "/dashboard", label: t("dash.title"), icon: "dashboard", exact: true },
        { href: "/dashboard/new-order", label: t("dash.newOrder"), icon: "cart" },
        { href: "/dashboard/orders", label: t("dash.orders"), icon: "list" },
      ],
    },
    {
      title: t("wallet.title"),
      items: [
        { href: "/dashboard/wallet", label: t("dash.addFunds"), icon: "wallet" },
        { href: "/dashboard/transactions", label: t("wallet.history"), icon: "creditCard" },
        { href: "/dashboard/affiliate", label: t("affiliate.title"), icon: "gift" },
      ],
    },
    {
      title: t("nav.support"),
      items: [
        { href: "/dashboard/tickets", label: t("dash.tickets"), icon: "ticket", badge: openTickets || undefined },
        { href: "/services", label: t("nav.services"), icon: "layers" },
        { href: "/dashboard/api", label: t("nav.api"), icon: "code" },
      ],
    },
    {
      title: t("nav.account"),
      items: [{ href: "/dashboard/profile", label: t("nav.profile"), icon: "user" }],
    },
  ];

  const primaryMobile: NavItem[] = [
    { href: "/dashboard", label: t("dash.title"), icon: "dashboard", exact: true },
    { href: "/dashboard/new-order", label: t("dash.newOrder"), icon: "cart" },
    { href: "/dashboard/orders", label: t("dash.orders"), icon: "list" },
    { href: "/dashboard/wallet", label: t("wallet.title"), icon: "wallet" },
    { href: "/dashboard/profile", label: t("nav.profile"), icon: "user" },
  ];

  return (
    <AppShell ctx={ctx} groups={groups} primaryMobile={primaryMobile} title={t("dash.title")}>
      {children}
    </AppShell>
  );
}
