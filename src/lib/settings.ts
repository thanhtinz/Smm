import { db } from "./db";

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
  "currency.display": { group: "locale", type: "text", value: "VND" },
  "currency.allowUserCurrency": { group: "locale", type: "boolean", value: true },
  "currency.autoRates": { group: "locale", type: "boolean", value: false },

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

let cache: Map<string, unknown> | null = null;
let cachedAt = 0;
const TTL = 5_000;

async function load(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cachedAt < TTL) return cache;
  const rows = await db.setting.findMany();
  const map = new Map<string, unknown>();
  for (const row of rows) {
    try {
      map.set(row.key, JSON.parse(row.value));
    } catch {
      map.set(row.key, row.value);
    }
  }
  cache = map;
  cachedAt = Date.now();
  return map;
}

export function invalidateSettings() {
  cache = null;
  cachedAt = 0;
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
  await db.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value), group },
    update: { value: JSON.stringify(value), group },
  });
  invalidateSettings();
}

export async function setSettings(entries: Record<string, unknown>) {
  for (const [key, value] of Object.entries(entries)) await setSetting(key, value);
}
