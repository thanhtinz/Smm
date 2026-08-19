import { roundMoney } from "./money";
import type { ProviderService } from "./providers";

/**
 * A provider's catalogue, read for a human who is about to pick from it.
 *
 * The wholesale standard hands back one flat list: every service the provider
 * sells, each tagged with a single free-text `category` string it invented.
 * There is no notion of a platform on their side, and the numbers arrive as
 * strings. So before an operator can choose anything, the list has to be made
 * into something countable and searchable — which is all this file does.
 *
 * It touches neither the database nor the network on purpose. Everything here
 * is a rule about their data, and a rule about their data is exactly the sort
 * of thing that is quietly wrong for months.
 */

export type CatalogueEntry = {
  /** The provider's own id for the service — what an order is placed against. */
  providerServiceId: string;
  name: string;
  category: string;
  /** Their price per 1,000, in the provider's currency. */
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
};

/** A category of theirs, with how much is in it — the list step one shows. */
export type CatalogueCategory = { name: string; count: number };

/** What a service with no category of its own is filed under. */
export const UNCATEGORISED = "Uncategorised";

const NAME_LIMIT = 250;
const CATEGORY_LIMIT = 120;

/**
 * Sell price from cost.
 *
 * To four places rather than to the base currency's own, because a price is
 * per thousand: a service costing $0.85 per 1,000 is worth less than a cent
 * each, and rounding the per-thousand figure to cents would flatten a whole
 * catalogue onto the same few prices.
 */
export function sellPrice(providerRate: number, markupPercent: number): number {
  return roundMoney(providerRate * (1 + markupPercent / 100), 4);
}

/**
 * One of their rows, made safe to show and to store.
 *
 * Every field is treated as untrusted: the numbers are strings by the
 * standard and are anything at all in practice, and the two text fields are
 * written straight into columns this panel indexes and displays.
 */
export function normaliseRow(row: Partial<ProviderService> & Record<string, unknown>): CatalogueEntry | null {
  const providerServiceId = String(row.service ?? "").trim();
  // A row this panel cannot place an order against is not a service.
  if (!providerServiceId) return null;

  const rate = Math.max(0, Number(row.rate) || 0);
  const min = Math.max(1, Math.floor(Number(row.min) || 1));
  // A provider that reports max below min has said nothing useful about the
  // ceiling; taking min as the ceiling is the reading that cannot oversell.
  const max = Math.max(min, Math.floor(Number(row.max) || min));

  const category = String(row.category ?? "").trim().slice(0, CATEGORY_LIMIT) || UNCATEGORISED;

  return {
    providerServiceId,
    name: String(row.name ?? providerServiceId).trim().slice(0, NAME_LIMIT) || providerServiceId,
    category,
    rate,
    min,
    max,
    refill: Boolean(row.refill),
    cancel: Boolean(row.cancel),
    dripfeed: Boolean(row.dripfeed),
  };
}

/** Their whole list, cleaned, with unusable rows dropped rather than shown. */
export function normaliseCatalogue(rows: unknown[]): CatalogueEntry[] {
  const entries: CatalogueEntry[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const entry = normaliseRow(row as Record<string, unknown>);
    if (!entry) continue;
    // Providers do repeat an id. The first one wins, so the list an operator
    // ticks matches the list the import walks.
    if (seen.has(entry.providerServiceId)) continue;
    seen.add(entry.providerServiceId);
    entries.push(entry);
  }

  return entries;
}

/**
 * Their categories, by name, with a count each.
 *
 * Sorted by name rather than by size: an operator arrives knowing the name of
 * the thing they came to import, and hunting for it down a list ordered by
 * something else is the whole reason this screen exists.
 */
export function catalogueCategories(entries: CatalogueEntry[]): CatalogueCategory[] {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether a row answers what was typed.
 *
 * The provider's own id is searched alongside the name, because an operator
 * who already knows which service they want has that id in front of them —
 * from an order, a message, or the provider's own site — and pasting it is
 * faster than reading a name they did not write.
 */
export function matchesQuery(entry: CatalogueEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${entry.providerServiceId} ${entry.name}`.toLowerCase().includes(q);
}

/** One category's services, in the order they will be shown and ticked. */
export function servicesInCategory(
  entries: CatalogueEntry[],
  category: string,
  query = "",
): CatalogueEntry[] {
  return entries.filter((entry) => entry.category === category && matchesQuery(entry, query));
}
