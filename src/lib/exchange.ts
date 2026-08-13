import { db } from "./db";
import { basePrisma } from "./db-base";
import { runAsPanel } from "./tenancy";
import { getSetting } from "./settings";
import { invalidateCurrencies } from "./currency";

/**
 * Keeps foreign-currency rates current.
 *
 * Currencies are shared by every panel, so the settings that drive this live
 * on the root panel and the update runs once for everyone.
 *
 * `Currency.rate` is the value of one base unit in that currency, which is
 * exactly what a rates API keyed on the base currency returns, so the figures
 * go in as they come out — adjusted only by the configured margin.
 */

const HOUR = 60 * 60 * 1000;

export type RateUpdate = { skipped: string } | { updated: string[]; missing: string[] };

export async function updateExchangeRates(force = false): Promise<RateUpdate> {
  const root = await basePrisma.panel.findFirst({ where: { parentId: null }, orderBy: { createdAt: "asc" } });
  if (!root) return { skipped: "no root panel" };

  return runAsPanel(root.id, async () => {
    if (!force && !(await getSetting("currency.autoUpdate"))) return { skipped: "switched off" };

    const base = await db.currency.findFirst({ where: { isBase: true } });
    if (!base) return { skipped: "no base currency" };

    const targets = await db.currency.findMany({
      where: { isBase: false, enabled: true, autoUpdate: true },
    });
    if (targets.length === 0) return { skipped: "nothing to update" };

    if (!force) {
      const everyHours = Math.max(1, Number(await getSetting("currency.updateEveryHours")) || 12);
      const freshest = targets.reduce<Date | null>(
        (newest, c) => (c.rateUpdatedAt && (!newest || c.rateUpdatedAt > newest) ? c.rateUpdatedAt : newest),
        null,
      );
      if (freshest && Date.now() - freshest.getTime() < everyHours * HOUR) {
        return { skipped: "updated recently" };
      }
    }

    const template = String(await getSetting("currency.rateApiUrl")).trim();
    if (!template) return { skipped: "no rates URL configured" };

    // Placeholders rather than a fixed provider shape: every rates service
    // takes the base and the key somewhere different in the URL.
    const url = template
      .replaceAll("{base}", encodeURIComponent(base.code))
      .replaceAll("{key}", encodeURIComponent(String(await getSetting("currency.rateApiKey"))));

    let rates: Record<string, unknown>;
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!res.ok) return { skipped: `rates service returned HTTP ${res.status}` };
      const body = (await res.json()) as Record<string, unknown>;
      // `rates` is the common key; `conversion_rates` is the other one in use.
      const found = (body.rates ?? body.conversion_rates) as Record<string, unknown> | undefined;
      if (!found || typeof found !== "object") return { skipped: "rates service returned no rates" };
      rates = found;
    } catch {
      return { skipped: "rates service could not be reached" };
    }

    const margin = Number(await getSetting("currency.rateMargin")) || 0;
    const now = new Date();
    const updated: string[] = [];
    const missing: string[] = [];

    for (const currency of targets) {
      const raw = Number(rates[currency.code]);
      if (!Number.isFinite(raw) || raw <= 0) {
        missing.push(currency.code);
        continue;
      }

      // The margin raises the rate, so a foreign price is a little above the
      // mid-market figure — the same cushion in both directions, since a
      // deposit converts back through the same number.
      const rate = raw * (1 + margin / 100);
      await db.currency.update({ where: { id: currency.id }, data: { rate, rateUpdatedAt: now } });
      updated.push(currency.code);
    }

    invalidateCurrencies();
    return { updated, missing };
  });
}
