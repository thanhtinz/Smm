import { db } from "./db";
import { currentPanelId } from "./tenancy";

/**
 * Every runtime-configurable value of the panel. Defaults live here, the
 * persisted override lives in the Setting table and is edited from the admin
 * area only — nothing below is meant to be changed by editing source files.
 */
export const settingDefinitions = {
  // --- Branding -----------------------------------------------------------
  "site.name": { group: "branding", type: "text", value: "Nova Panel" },
  "site.tagline": { group: "branding", type: "text", value: "Social media growth, delivered" },
  "site.description": {
    group: "branding",
    type: "textarea",
    value: "The fastest SMM panel to grow your social presence with reliable, automated delivery.",
  },
  "site.logoText": { group: "branding", type: "text", value: "Nova" },
  "site.logoUrl": { group: "branding", type: "text", value: "" },
  "site.faviconUrl": { group: "branding", type: "text", value: "" },
  "site.supportEmail": { group: "branding", type: "text", value: "support@novapanel.io" },
  "site.telegram": { group: "branding", type: "text", value: "" },
  "site.whatsapp": { group: "branding", type: "text", value: "" },
  "site.facebook": { group: "branding", type: "text", value: "" },

  // --- Appearance ---------------------------------------------------------
  "appearance.defaultTheme": { group: "appearance", type: "text", value: "aurora" },
  "appearance.defaultColorMode": { group: "appearance", type: "select", value: "dark", options: ["dark", "light", "system"] },
  "appearance.allowUserTheme": { group: "appearance", type: "boolean", value: true },
  "appearance.landingLayout": { group: "appearance", type: "select", value: "spotlight", options: ["spotlight", "editorial", "minimal"] },

  // --- Localisation -------------------------------------------------------
  "locale.default": { group: "locale", type: "text", value: "vi" },
  "locale.allowUserLocale": { group: "locale", type: "boolean", value: true },
  "currency.base": { group: "locale", type: "text", value: "VND" },
  "currency.autoUpdate": { group: "locale", type: "boolean", value: false },
  "currency.rateApiUrl": {
    group: "locale",
    type: "text",
    value: "https://open.er-api.com/v6/latest/{base}",
  },
  "currency.rateApiKey": { group: "locale", type: "password", value: "" },
  "currency.rateMargin": { group: "locale", type: "number", value: 0 },
  "currency.updateEveryHours": { group: "locale", type: "number", value: 12 },
  "currency.display": { group: "locale", type: "text", value: "VND" },
  "currency.allowUserCurrency": { group: "locale", type: "boolean", value: true },

  // --- Orders -------------------------------------------------------------
  "order.enabled": { group: "order", type: "boolean", value: true },
  "order.minCharge": { group: "order", type: "number", value: 0 },
  "order.duplicateWindowMinutes": { group: "order", type: "number", value: 0 },
  "order.autoSendToProvider": { group: "order", type: "boolean", value: false },
  "order.refillWindowDays": { group: "order", type: "number", value: 30 },
  "order.allowCancelRequests": { group: "order", type: "boolean", value: true },

  // --- Wallet -------------------------------------------------------------
  "wallet.minDeposit": { group: "wallet", type: "number", value: 20000 },
  "wallet.maxDeposit": { group: "wallet", type: "number", value: 500000000 },
  "wallet.autoApprove": { group: "wallet", type: "boolean", value: true },
  "wallet.quickAmounts": {
    group: "wallet",
    type: "json",
    value: {
      VND: [50000, 100000, 200000, 500000, 1000000],
      USD: [5, 10, 25, 50, 100],
      EUR: [5, 10, 25, 50, 100],
      TRY: [100, 250, 500, 1000],
      INR: [500, 1000, 2500, 5000],
    } as Record<string, number[]>,
  },

  // --- Affiliate ----------------------------------------------------------
  "affiliate.enabled": { group: "affiliate", type: "boolean", value: true },
  "affiliate.commissionPercent": { group: "affiliate", type: "number", value: 5 },
  "affiliate.minWithdraw": { group: "affiliate", type: "number", value: 50000 },

  // --- Registration -------------------------------------------------------
  "auth.registrationOpen": { group: "auth", type: "boolean", value: true },
  "auth.requireEmailVerification": { group: "auth", type: "boolean", value: false },
  "auth.signupBonus": { group: "auth", type: "number", value: 0 },
  "auth.captchaProvider": {
    group: "auth",
    type: "select",
    value: "off",
    options: ["off", "turnstile", "hcaptcha", "recaptcha"],
  },
  "auth.captchaSiteKey": { group: "auth", type: "text", value: "" },
  "auth.captchaSecret": { group: "auth", type: "password", value: "" },
  "auth.captchaOnLogin": { group: "auth", type: "boolean", value: true },
  "auth.captchaOnRegister": { group: "auth", type: "boolean", value: true },
  "auth.termsRequired": { group: "auth", type: "boolean", value: true },

  // --- API ----------------------------------------------------------------
  "api.enabled": { group: "api", type: "boolean", value: true },
  "api.rateLimitPerMinute": { group: "api", type: "number", value: 120 },

  // --- Support ------------------------------------------------------------
  "support.enabled": { group: "support", type: "boolean", value: true },
  "support.maxOpenTickets": { group: "support", type: "number", value: 5 },
  "support.categories": {
    group: "support",
    type: "list",
    value: ["general", "payment", "order", "api", "other"],
  },

  // --- Child panels -------------------------------------------------------
  "panel.childrenEnabled": { group: "panel", type: "boolean", value: false },
  "panel.maxDepth": { group: "panel", type: "number", value: 3 },
  "panel.maxChildren": { group: "panel", type: "number", value: 0 },
  "panel.rentPrice": { group: "panel", type: "number", value: 0 },
  "panel.rentPeriodDays": { group: "panel", type: "number", value: 30 },
  "panel.graceDays": { group: "panel", type: "number", value: 3 },
  "panel.cloudflareToken": { group: "panel", type: "password", value: "" },
  "panel.cloudflareZoneId": { group: "panel", type: "text", value: "" },

  // --- Maintenance --------------------------------------------------------
  "maintenance.enabled": { group: "maintenance", type: "boolean", value: false },
  "maintenance.message": {
    group: "maintenance",
    type: "textarea",
    value: "We are performing scheduled maintenance. Please come back shortly.",
  },
} as const;

export type SettingKey = keyof typeof settingDefinitions;
type SettingValue<K extends SettingKey> = (typeof settingDefinitions)[K]["value"];

/**
 * Keyed by panel: settings are the one piece of reference data every panel
 * holds its own copy of, and a process-wide cache would hand one panel's
 * branding to another.
 */
const cache = new Map<string, { at: number; map: Map<string, unknown> }>();
const TTL = 5_000;

async function load(): Promise<Map<string, unknown>> {
  const panelId = await currentPanelId();
  const hit = cache.get(panelId);
  if (hit && Date.now() - hit.at < TTL) return hit.map;

  const rows = await db.setting.findMany();
  const map = new Map<string, unknown>();
  for (const row of rows) {
    try {
      map.set(row.key, JSON.parse(row.value));
    } catch {
      map.set(row.key, row.value);
    }
  }
  cache.set(panelId, { at: Date.now(), map });
  return map;
}

/** Drops one panel's entry, or all of them when there is no panel in context. */
export function invalidateSettings(panelId?: string) {
  if (panelId) cache.delete(panelId);
  else cache.clear();
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const map = await load();
  if (map.has(key)) return map.get(key) as SettingValue<K>;
  return settingDefinitions[key].value as SettingValue<K>;
}

export async function getSettings(): Promise<Record<SettingKey, unknown>> {
  const map = await load();
  const out = {} as Record<string, unknown>;
  for (const [key, def] of Object.entries(settingDefinitions)) {
    out[key] = map.has(key) ? map.get(key) : def.value;
  }
  return out as Record<SettingKey, unknown>;
}

export async function setSetting(key: string, value: unknown) {
  const group = (settingDefinitions as Record<string, { group: string }>)[key]?.group ?? "general";
  const panelId = await currentPanelId();
  await db.setting.upsert({
    where: { panelId_key: { panelId, key } },
    create: { key, value: JSON.stringify(value), group },
    update: { value: JSON.stringify(value), group },
  });
  invalidateSettings(panelId);
}

export async function setSettings(entries: Record<string, unknown>) {
  for (const [key, value] of Object.entries(entries)) await setSetting(key, value);
}
