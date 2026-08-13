"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CURRENCY_COOKIE, LOCALE_COOKIE, MODE_COOKIE, THEME_COOKIE } from "@/lib/context";

const YEAR = 60 * 60 * 24 * 365;

async function persist(cookie: string, value: string, column?: "locale" | "currency" | "theme" | "colorMode") {
  const jar = await cookies();
  jar.set(cookie, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  if (column) {
    const user = await getCurrentUser();
    if (user) await db.user.update({ where: { id: user.id }, data: { [column]: value } });
  }
  revalidatePath("/", "layout");
}

export async function setLocale(code: string) {
  await persist(LOCALE_COOKIE, code, "locale");
}

export async function setCurrency(code: string) {
  await persist(CURRENCY_COOKIE, code, "currency");
}

export async function setTheme(slug: string) {
  await persist(THEME_COOKIE, slug, "theme");
}

export async function setColorMode(mode: string) {
  await persist(MODE_COOKIE, mode === "light" ? "light" : "dark", "colorMode");
}
