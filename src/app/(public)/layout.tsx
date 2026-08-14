import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { guardPanel } from "@/lib/tenancy";
import PanelSuspended from "@/components/panel-suspended";
import MaintenanceNotice from "@/components/maintenance-notice";
import { maintenanceState } from "@/lib/maintenance";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
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
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader ctx={ctx} />
      <main className="flex-1">{children}</main>
      <SiteFooter ctx={ctx} />
    </div>
  );
}
