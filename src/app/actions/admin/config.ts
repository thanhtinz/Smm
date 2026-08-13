"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
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
  const admin = await requireAdmin();

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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();

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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();

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
