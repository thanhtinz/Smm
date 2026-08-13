"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireRootAdmin, logActivity } from "@/lib/auth";
import { getCurrentPanel } from "@/lib/tenancy";
import { invalidateSettings, setSetting, settingDefinitions } from "@/lib/settings";
import { invalidateCurrencies } from "@/lib/currency";
import { invalidateDictionaries } from "@/lib/i18n";
import { drivers, parseConfig } from "@/lib/payments";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

function num(form: FormData, key: string, fallback = 0) {
  const value = Number(String(form.get(key) ?? "").trim());
  return Number.isFinite(value) ? value : fallback;
}

function bool(form: FormData, key: string) {
  return form.get(key) === "on" || form.get(key) === "true";
}

// ----------------------------------------------------------------- settings

export async function saveSettingsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  // Only keys the form declares are touched, so one group's form cannot
  // blank out settings belonging to another.
  const keys = form.getAll("__keys").map(String);
  for (const key of keys) {
    const def = (settingDefinitions as Record<string, { type: string }>)[key];
    if (!def) continue;

    let value: unknown;
    switch (def.type) {
      case "boolean":
        value = bool(form, key);
        break;
      case "number":
        value = num(form, key);
        break;
      case "list":
        value = String(form.get(key) ?? "")
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "password": {
        const raw = String(form.get(key) ?? "");
        if (raw === "") continue;
        value = raw;
        break;
      }
      case "json":
        try {
          value = JSON.parse(String(form.get(key) ?? "{}"));
        } catch {
          return { fieldErrors: { [key]: "That is not valid JSON" } };
        }
        break;
      default:
        value = String(form.get(key) ?? "");
    }
    await setSetting(key, value);
  }

  await logActivity(admin.id, "admin.settings.update", keys.join(","));
  invalidateSettings();
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------- payment methods

export async function savePaymentMethodAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const method = await db.paymentMethod.findUnique({ where: { id } });
  if (!method) return { error: "Payment method not found" };

  const driver = drivers[method.driver];
  const config = parseConfig(method.config);
  if (driver) {
    for (const field of driver.fields) {
      const raw = form.get(`config.${field.name}`);
      // A blank password field means "leave the stored secret alone" rather
      // than "erase it", so an admin can edit other fields safely.
      if (raw === null) continue;
      const value = String(raw);
      if (field.type === "password" && value === "") continue;
      config[field.name] = value;
    }
  }

  const currencies = form
    .getAll("currencies")
    .map(String)
    .filter(Boolean);

  await db.paymentMethod.update({
    where: { id },
    data: {
      name: String(form.get("name") ?? method.name).trim() || method.name,
      description: String(form.get("description") ?? "").trim(),
      enabled: bool(form, "enabled"),
      minAmount: num(form, "minAmount"),
      maxAmount: num(form, "maxAmount"),
      feePercent: num(form, "feePercent"),
      feeFixed: num(form, "feeFixed"),
      bonusPercent: num(form, "bonusPercent"),
      position: num(form, "position"),
      currencies: JSON.stringify(currencies),
      config: JSON.stringify(config),
    },
  });

  await logActivity(admin.id, "admin.payment.update", method.code);
  revalidatePath("/admin/payment-methods");
  revalidatePath("/dashboard/wallet");
  return { ok: true };
}

// --------------------------------------------------------------- currencies

export async function saveCurrencyAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireRootAdmin();

  const id = String(form.get("id") ?? "");
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return { fieldErrors: { code: "Use a three-letter code, e.g. USD" } };

  const rate = num(form, "rate", -1);
  if (rate <= 0) return { fieldErrors: { rate: "Rate must be greater than zero" } };

  const clash = await db.currency.findFirst({ where: { code, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { code: "That currency already exists" } };

  const data = {
    code,
    name: String(form.get("name") ?? "").trim() || code,
    symbol: String(form.get("symbol") ?? "").trim() || code,
    symbolBefore: bool(form, "symbolBefore"),
    decimals: Math.max(0, Math.min(8, num(form, "decimals"))),
    rate,
    enabled: bool(form, "enabled"),
    position: num(form, "position"),
  };

  if (id) await db.currency.update({ where: { id }, data });
  else await db.currency.create({ data });

  await logActivity(admin.id, "admin.currency.save", code);
  invalidateCurrencies();
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCurrencyAction(id: string): Promise<ActionResult> {
  const admin = await requireRootAdmin();
  const currency = await db.currency.findUnique({ where: { id } });
  if (!currency) return { error: "Currency not found" };
  if (currency.isBase) return { error: "The base currency cannot be deleted. Set another as base first." };

  await db.currency.delete({ where: { id } });
  await logActivity(admin.id, "admin.currency.delete", currency.code);
  invalidateCurrencies();
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Moving the base rebases every other rate so relative values are preserved. */
export async function setBaseCurrencyAction(id: string): Promise<ActionResult> {
  const admin = await requireRootAdmin();
  const target = await db.currency.findUnique({ where: { id } });
  if (!target) return { error: "Currency not found" };
  if (target.rate <= 0) return { error: "That currency has no usable rate." };

  const all = await db.currency.findMany();
  const divisor = target.rate;

  await db.$transaction(
    all.map((c) =>
      db.currency.update({
        where: { id: c.id },
        data: { rate: c.rate / divisor, isBase: c.id === id },
      })
    )
  );

  await setSetting("currency.base", target.code);
  await logActivity(admin.id, "admin.currency.base", target.code);
  invalidateCurrencies();
  invalidateSettings();
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- languages

export async function saveLanguageAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireRootAdmin();

  const id = String(form.get("id") ?? "");
  const code = String(form.get("code") ?? "").trim().toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(code)) {
    return { fieldErrors: { code: "Use a language code like vi, en or pt-br" } };
  }

  const clash = await db.language.findFirst({ where: { code, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { code: "That language already exists" } };

  const data = {
    code,
    name: String(form.get("name") ?? "").trim() || code,
    nativeName: String(form.get("nativeName") ?? "").trim() || code,
    direction: String(form.get("direction") ?? "ltr") === "rtl" ? "rtl" : "ltr",
    enabled: bool(form, "enabled"),
    position: num(form, "position"),
  };

  if (id) await db.language.update({ where: { id }, data });
  else await db.language.create({ data });

  await logActivity(admin.id, "admin.language.save", code);
  invalidateDictionaries();
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteLanguageAction(id: string): Promise<ActionResult> {
  const admin = await requireRootAdmin();
  const language = await db.language.findUnique({ where: { id } });
  if (!language) return { error: "Language not found" };

  const remaining = await db.language.count({ where: { enabled: true, NOT: { id } } });
  if (remaining === 0) return { error: "At least one language must remain enabled." };

  await db.language.delete({ where: { id } });
  await logActivity(admin.id, "admin.language.delete", language.code);
  invalidateDictionaries();
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Saves only the keys that differ from what is already stored. */
export async function saveTranslationsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireRootAdmin();

  const languageId = String(form.get("languageId") ?? "");
  const language = await db.language.findUnique({ where: { id: languageId } });
  if (!language) return { error: "Language not found" };

  const existing = await db.translation.findMany({ where: { languageId } });
  const current = new Map(existing.map((t) => [t.key, t.value]));

  let changed = 0;
  for (const [field, raw] of form.entries()) {
    if (!field.startsWith("t.")) continue;
    const key = field.slice(2);
    const value = String(raw);
    if (current.get(key) === value) continue;

    if (value.trim() === "") {
      // Clearing a string falls back to the bundled dictionary.
      await db.translation.deleteMany({ where: { languageId, namespace: "common", key } });
    } else {
      await db.translation.upsert({
        where: { languageId_namespace_key: { languageId, namespace: "common", key } },
        create: { languageId, namespace: "common", key, value },
        update: { value },
      });
    }
    changed += 1;
  }

  await logActivity(admin.id, "admin.translations.update", `${language.code} (${changed})`);
  invalidateDictionaries();
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------- themes

const COLOR_TOKENS = [
  "bg",
  "surface",
  "surface2",
  "border",
  "text",
  "muted",
  "primary",
  "primaryFg",
  "accent",
  "success",
  "warning",
  "danger",
] as const;

export async function saveThemeAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireRootAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: "Enter a name" } };

  const slug = String(form.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return { fieldErrors: { slug: "Enter a slug" } };

  const clash = await db.theme.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { slug: "That slug is already used" } };

  const read = (mode: "light" | "dark") => {
    const out: Record<string, string> = {};
    for (const token of COLOR_TOKENS) out[token] = String(form.get(`${mode}.${token}`) ?? "").trim() || "#000000";
    out.bgAccent = String(form.get(`${mode}.bgAccent`) ?? "").trim() || "none";
    return out;
  };

  const tokens = {
    radius: String(form.get("radius") ?? "16px").trim() || "16px",
    font: String(form.get("font") ?? "").trim() || "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    light: read("light"),
    dark: read("dark"),
  };

  const data = {
    slug,
    name,
    description: String(form.get("description") ?? "").trim(),
    layout: String(form.get("layout") ?? "classic"),
    enabled: bool(form, "enabled"),
    position: num(form, "position"),
    tokens: JSON.stringify(tokens),
  };

  if (id) await db.theme.update({ where: { id }, data });
  else await db.theme.create({ data });

  await logActivity(admin.id, "admin.theme.save", slug);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteThemeAction(id: string): Promise<ActionResult> {
  const admin = await requireRootAdmin();
  const theme = await db.theme.findUnique({ where: { id } });
  if (!theme) return { error: "Theme not found" };
  if (theme.isDefault) return { error: "The default theme cannot be deleted. Make another one default first." };

  const remaining = await db.theme.count({ where: { enabled: true, NOT: { id } } });
  if (remaining === 0) return { error: "At least one theme must remain enabled." };

  // Anyone still on this skin falls back to the default.
  const fallback = await db.theme.findFirst({ where: { isDefault: true } });
  if (fallback) await db.user.updateMany({ where: { theme: theme.slug }, data: { theme: fallback.slug } });

  await db.theme.delete({ where: { id } });
  await logActivity(admin.id, "admin.theme.delete", theme.slug);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setDefaultThemeAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const theme = await db.theme.findUnique({ where: { id } });
  if (!theme) return { error: "Theme not found" };

  // Which theme this panel opens on is its own setting. The isDefault flag on
  // the shared Theme row decides what a panel with no setting falls back to,
  // so only the root panel moves it.
  await setSetting("appearance.defaultTheme", theme.slug);

  const panel = await getCurrentPanel();
  if (panel && panel.parentId === null) {
    await db.$transaction([
      db.theme.updateMany({ data: { isDefault: false } }),
      db.theme.update({ where: { id }, data: { isDefault: true, enabled: true } }),
    ]);
  }

  await logActivity(admin.id, "admin.theme.default", theme.slug);
  invalidateSettings();
  revalidatePath("/", "layout");
  return { ok: true };
}

// ------------------------------------------------------------------ coupons

export async function saveCouponAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const code = String(form.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (code.length < 3) return { fieldErrors: { code: "Use at least three characters" } };

  const clash = await db.coupon.findFirst({ where: { code, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { code: "That code already exists" } };

  const type = String(form.get("type") ?? "percent") === "fixed" ? "fixed" : "percent";
  const value = num(form, "value", -1);
  if (value <= 0) return { fieldErrors: { value: "Enter a value above zero" } };
  if (type === "percent" && value > 100) return { fieldErrors: { value: "A percentage cannot exceed 100" } };

  const expiresRaw = String(form.get("expiresAt") ?? "").trim();
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return { fieldErrors: { expiresAt: "That is not a valid date" } };
  }

  const data = {
    code,
    type,
    value,
    minAmount: num(form, "minAmount"),
    maxUses: Math.max(0, num(form, "maxUses")),
    maxPerUser: Math.max(0, num(form, "maxPerUser")),
    firstDepositOnly: bool(form, "firstDepositOnly"),
    enabled: bool(form, "enabled"),
    expiresAt,
  };

  if (id) await db.coupon.update({ where: { id }, data });
  else await db.coupon.create({ data });

  await logActivity(admin.id, "admin.coupon.save", code);
  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const used = await db.couponRedemption.count({ where: { couponId: id } });
  if (used > 0) {
    // Redemptions are part of the deposit record, so a used coupon is
    // disabled rather than deleted.
    await db.coupon.update({ where: { id }, data: { enabled: false } });
    revalidatePath("/admin/coupons");
    return { error: `This coupon has been used ${used} time${used === 1 ? "" : "s"}, so it was disabled instead of deleted.` };
  }
  await db.coupon.delete({ where: { id } });
  await logActivity(admin.id, "admin.coupon.delete", id);
  revalidatePath("/admin/coupons");
  return { ok: true };
}
