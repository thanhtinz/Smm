"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  CURRENCY_COOKIE,
  DIRECTION_COOKIE,
  LOCALE_COOKIE,
  MODE_COOKIE,
  THEME_COOKIE,
  TIMEZONE_COOKIE,
} from "@/lib/context";

const YEAR = 60 * 60 * 24 * 365;

async function persist(
  cookie: string,
  value: string,
  column?: "locale" | "currency" | "theme" | "colorMode" | "timezone" | "direction",
) {
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

/**
 * Refused rather than stored when Intl does not know the name: an unknown
 * zone throws at format time, which would take every page down long after
 * whatever set it.
 */
export async function setTimezone(name: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
  } catch {
    return;
  }
  await persist(TIMEZONE_COOKIE, name, "timezone");
}

/**
 * Which way the interface is laid out. Blank hands it back to the language,
 * which is the setting almost every reader should be on; anything that is not
 * one of the three is treated as blank rather than stored, so a stray value
 * cannot leave somebody with a page they cannot use.
 */
export async function setDirection(direction: string) {
  const value = direction === "ltr" || direction === "rtl" ? direction : "";
  await persist(DIRECTION_COOKIE, value, "direction");
}

export async function setColorMode(mode: string) {
  await persist(MODE_COOKIE, mode === "light" ? "light" : "dark", "colorMode");
}
