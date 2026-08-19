import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentPanelId, getRootPanel } from "@/lib/tenancy";
import { getAppContext } from "@/lib/context";
import ProviderImport from "@/components/admin/provider-import";

export const metadata: Metadata = { title: "Import services" };

export default async function AdminProviderImportPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const ctx = await getAppContext();

  // Same gate as the providers page, and for the same reason: a child panel
  // buys from its parent and has no supplier of its own to import from. After
  // the context rather than before it, which is what tells the build this page
  // is rendered per request and has a host to resolve a panel from.
  const [root, panelId] = await Promise.all([getRootPanel(), currentPanelId()]);
  if (!root || root.id !== panelId) notFound();

  const { t } = ctx;
  const { provider: preselected } = await searchParams;

  const [providers, platforms] = await Promise.all([
    db.provider.findMany({ where: { enabled: true }, orderBy: { name: "asc" } }),
    db.platform.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        categories: { orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ProviderImport
        preselectedProviderId={providers.some((p) => p.id === preselected) ? preselected! : ""}
        providers={providers.map((p) => ({ id: p.id, name: p.alias.trim() || p.name, markupPercent: p.markupPercent }))}
        platforms={platforms}
        labels={{
          title: t("import.title"),
          back: t("import.back"),
          stepProvider: t("import.stepProvider"),
          stepTheirCategory: t("import.stepTheirCategory"),
          stepDestination: t("import.stepDestination"),
          stepOurPlatform: t("import.stepOurPlatform"),
          stepOurCategory: t("import.stepOurCategory"),
          stepServices: t("import.stepServices"),
          load: t("import.load"),
          loading: t("import.loading"),
          choose: t("import.choose"),
          filterCategories: t("import.filterCategories"),
          searchServices: t("import.searchServices"),
          selectAll: t("import.selectAll"),
          picked: t("import.picked"),
          already: t("import.already"),
          submit: t("import.submit"),
          done: t("import.done"),
          noPlatforms: t("import.noPlatforms"),
          noCategories: t("import.noCategories"),
          noServices: t("import.noServices"),
          markupNote: t("import.markupNote"),
          cost: t("admin.providerRate"),
          sell: t("admin.rate"),
          quantity: t("order.quantity"),
          service: t("admin.name"),
          providerServiceId: t("admin.providerServiceId"),
        }}
      />
    </div>
  );
}
