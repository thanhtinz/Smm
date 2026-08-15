import { redirect } from "next/navigation";
import AppShell, { type Catalogue, type NavGroup, type NavItem } from "@/components/app-shell";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { guardPanel } from "@/lib/tenancy";
import PanelSuspended from "@/components/panel-suspended";
import MaintenanceNotice from "@/components/maintenance-notice";
import { maintenanceState } from "@/lib/maintenance";
import { db } from "@/lib/db";
import AnnouncementBanner from "@/components/announcement-banner";
import ContactDock from "@/components/landing/contact-dock";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const panel = await guardPanel();
  if (panel.status !== "active") return <PanelSuspended name={panel.name} note={panel.statusNote} />;

  // Staff are let through, so the panel can be fixed while it is closed.
  const closed = await maintenanceState();
  if (closed.on) {
    return (
      <MaintenanceNotice
        site={String(await getSetting("site.name"))}
        message={closed.message}
        signIn={(await getAppContext()).t("nav.signin")}
      />
    );
  }

  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");

  const { t } = ctx;
  const [openTickets, platforms] = await Promise.all([
    db.ticket.count({ where: { userId: ctx.user.id, status: { in: ["open", "answered"] } } }),
    // Only what is actually on sale: a platform whose categories are all
    // empty opens onto nothing, and a category with no enabled service is a
    // page with a service picker that cannot be answered.
    db.platform.findMany({
      where: { visible: true, categories: { some: { visible: true, services: { some: { enabled: true } } } } },
      orderBy: { position: "asc" },
      select: {
        slug: true,
        name: true,
        icon: true,
        image: true,
        color: true,
        categories: {
          where: { visible: true, services: { some: { enabled: true } } },
          orderBy: [{ position: "asc" }, { name: "asc" }],
          select: { slug: true, name: true },
        },
      },
    }),
  ]);

  const catalogue: Catalogue = { title: t("nav.services"), platforms };

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
      items: [
        { href: "/dashboard/notifications", label: t("dash.notifications"), icon: "bell" },
        { href: "/dashboard/profile", label: t("nav.profile"), icon: "user" },
      ],
    },
  ];

  const primaryMobile: NavItem[] = [
    { href: "/dashboard", label: t("dash.title"), icon: "dashboard", exact: true },
    { href: "/dashboard/new-order", label: t("dash.newOrder"), icon: "cart" },
    { href: "/dashboard/orders", label: t("dash.orders"), icon: "list" },
    { href: "/dashboard/wallet", label: t("wallet.title"), icon: "wallet" },
    { href: "/dashboard/profile", label: t("nav.profile"), icon: "user" },
  ];

  const notices = await db.announcement.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <AppShell ctx={ctx} groups={groups} catalogue={catalogue} primaryMobile={primaryMobile} title={t("dash.title")}>
      {notices.length > 0 && (
        <div className="mb-5">
          <AnnouncementBanner
            closeLabel={t("common.close")}
            items={notices.map((a) => ({ id: a.id, title: a.title, body: a.body, level: a.level }))}
          />
        </div>
      )}
      {children}

      {/* Support is needed more often once money is involved, not less: this
          is where an order is stuck and a balance is wrong. Raised so it
          clears the bottom bar that replaces the sidebar on a phone. */}
      <ContactDock
        settings={ctx.settings}
        labels={{ zalo: t("landing.contact.zalo"), telegram: t("landing.contact.telegram") }}
        raised
      />
    </AppShell>
  );
}
