import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { getAppContext } from "@/lib/context";
import { guardPanel } from "@/lib/tenancy";
import PanelSuspended from "@/components/panel-suspended";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const panel = await guardPanel();
  if (panel.status !== "active") return <PanelSuspended name={panel.name} note={panel.statusNote} />;

  const ctx = await getAppContext();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader ctx={ctx} />
      <main className="flex-1">{children}</main>
      <SiteFooter ctx={ctx} />
    </div>
  );
}
