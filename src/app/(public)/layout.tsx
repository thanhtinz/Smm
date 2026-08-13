import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { getAppContext } from "@/lib/context";
import { guardPanel } from "@/lib/panel";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  await guardPanel();
  const ctx = await getAppContext();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader ctx={ctx} />
      <main className="flex-1">{children}</main>
      <SiteFooter ctx={ctx} />
    </div>
  );
}
