import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { guardPanel } from "@/lib/tenancy";
import PanelSuspended from "@/components/panel-suspended";
import MaintenanceNotice from "@/components/maintenance-notice";
import ContactDock from "@/components/landing/contact-dock";
import { maintenanceState } from "@/lib/maintenance";
import { headers } from "next/headers";
import { PATHNAME_HEADER } from "@/lib/panel-host";

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
  // The home page's colour mode is the layout's, not the reader's — the root
  // layout stamps it — so the switch that would fight it is not offered here.
  const onLanding = ((await headers()).get(PATHNAME_HEADER) ?? "") === "/";

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader ctx={ctx} showMode={!onLanding} />
      <main className="flex-1">{children}</main>
      <SiteFooter ctx={ctx} />
      <ContactDock
        settings={ctx.settings}
        labels={{ zalo: ctx.t("landing.contact.zalo"), telegram: ctx.t("landing.contact.telegram") }}
      />
    </div>
  );
}
