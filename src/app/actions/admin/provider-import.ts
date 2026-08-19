"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRootAdmin, logActivity } from "@/lib/auth";
import { fetchProviderServices, providerLabel } from "@/lib/providers";
import {
  catalogueCategories,
  normaliseCatalogue,
  sellPrice,
  type CatalogueCategory,
  type CatalogueEntry,
} from "@/lib/provider-catalogue";
import { nextPublicId } from "@/lib/ids";
import { readerMessages } from "@/lib/context";
import type { ActionResult } from "./catalogue";

/**
 * Importing from a provider, one deliberate choice at a time.
 *
 * The old import was a single button that took the provider's entire list,
 * invented a hidden platform to hang it off and named the categories after
 * whatever strings the provider had typed. An operator got a few thousand
 * rows and then had to tidy them by hand.
 *
 * Here the operator picks: their category, then this panel's platform and
 * category, then the individual services. Nothing is guessed, and nothing is
 * created that they did not name.
 */

/** How much of their catalogue is read in one pass. */
const MAX_ROWS = 5000;

export type CatalogueRow = CatalogueEntry & {
  /** Already stocked from this provider, so it cannot be taken on twice. */
  imported: boolean;
  /** What it would sell for at this provider's markup, before they commit. */
  sell: number;
};

export type CatalogueResult = {
  error?: string;
  categories?: CatalogueCategory[];
  services?: CatalogueRow[];
};

/**
 * Reads the provider's list for the screen.
 *
 * It is fetched rather than cached: an operator opens this screen precisely
 * when they believe the provider has something new, and a list from an hour
 * ago would not have it.
 */
export async function loadProviderCatalogueAction(providerId: string): Promise<CatalogueResult> {
  const t = await readerMessages();
  await requireRootAdmin();

  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) return { error: t("adm.providerMissing") };

  const result = await fetchProviderServices(provider);
  if (!result.ok) return { error: t("adm.providerCallFailed", { detail: result.error }) };
  if (!Array.isArray(result.data)) return { error: t("adm.providerNoList") };

  const entries = normaliseCatalogue(result.data.slice(0, MAX_ROWS));
  // An empty list is far more often a broken key than a provider that has
  // stopped selling, and an operator staring at a blank screen deserves the
  // difference spelled out.
  if (entries.length === 0) return { error: t("adm.providerEmptyList") };

  const stocked = new Set(
    (
      await db.service.findMany({
        where: { providerId: provider.id },
        select: { providerServiceId: true },
      })
    ).map((s) => s.providerServiceId),
  );

  return {
    categories: catalogueCategories(entries),
    services: entries.map((entry) => ({
      ...entry,
      imported: stocked.has(entry.providerServiceId),
      sell: sellPrice(entry.rate, provider.markupPercent),
    })),
  };
}

export type ImportResult = ActionResult & { created?: number; skipped?: number };

/**
 * Takes on the ticked services, under the category the operator chose.
 *
 * The provider's list is read again rather than trusted from the browser: the
 * price that gets stored is the price the provider quotes at the moment of
 * import, not a number that travelled through a form.
 */
export async function importSelectedServicesAction(
  providerId: string,
  categoryId: string,
  providerServiceIds: string[],
): Promise<ImportResult> {
  const t = await readerMessages();
  const admin = await requireRootAdmin();

  if (providerServiceIds.length === 0) return { error: t("adm.importNothingPicked") };

  const provider = await db.provider.findUnique({ where: { id: providerId } });
  if (!provider) return { error: t("adm.providerMissing") };

  // Reading it through `db` is what proves the category belongs to this panel:
  // the tenant filter answers with nothing for anyone else's.
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) return { error: t("adm.categoryMissing") };

  const result = await fetchProviderServices(provider);
  if (!result.ok) return { error: t("adm.providerCallFailed", { detail: result.error }) };
  if (!Array.isArray(result.data)) return { error: t("adm.providerNoList") };

  const upstream = new Map(
    normaliseCatalogue(result.data.slice(0, MAX_ROWS)).map((entry) => [entry.providerServiceId, entry]),
  );

  const stocked = new Set(
    (
      await db.service.findMany({
        where: { providerId: provider.id },
        select: { providerServiceId: true },
      })
    ).map((s) => s.providerServiceId),
  );

  let created = 0;
  let skipped = 0;

  for (const providerServiceId of providerServiceIds) {
    const entry = upstream.get(providerServiceId);
    // Gone from their list between loading the screen and pressing the button,
    // or already stocked. Neither is worth failing the whole import over.
    if (!entry || stocked.has(providerServiceId)) {
      skipped += 1;
      continue;
    }

    await db.service.create({
      data: {
        publicId: await nextPublicId("service"),
        categoryId: category.id,
        providerId: provider.id,
        providerServiceId,
        name: entry.name,
        rate: sellPrice(entry.rate, provider.markupPercent),
        providerRate: entry.rate,
        autoPrice: true,
        min: entry.min,
        max: entry.max,
        refill: entry.refill,
        cancel: entry.cancel,
        dripfeed: entry.dripfeed,
        // Nothing goes on sale before an operator has looked at it.
        enabled: false,
      },
    });
    stocked.add(providerServiceId);
    created += 1;
  }

  await logActivity(
    admin.id,
    "admin.provider.import",
    `${providerLabel(provider)} -> ${category.name}: +${created}`,
  );
  revalidatePath("/admin/services");
  revalidatePath("/admin/providers/import");
  return { ok: true, created, skipped };
}
