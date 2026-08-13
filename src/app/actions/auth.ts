"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, logActivity, verifyPassword } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { nextPublicId } from "@/lib/ids";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const loginSchema = z.object({
  identifier: z.string().min(1, "Enter your username or email"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    identifier: String(formData.get("identifier") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: { identifier: raw.identifier } };
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ username: parsed.data.identifier }, { email: parsed.data.identifier.toLowerCase() }],
    },
  });

  // One generic message for both branches so the form cannot be used to
  // enumerate which usernames exist.
  if (!user || !(await verifyPassword(parsed.data.password, user.password))) {
    await logActivity(user?.id ?? null, "login.failed", raw.identifier);
    return { error: "Those credentials do not match an account.", values: { identifier: raw.identifier } };
  }
  if (user.banned) {
    return {
      error: user.banReason ? `This account is suspended: ${user.banReason}` : "This account is suspended.",
      values: { identifier: raw.identifier },
    };
  }

  await createSession(user.id);
  await logActivity(user.id, "login.success");
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "At least 3 characters")
      .max(24, "At most 24 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscore only"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
    terms: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSetting("auth.registrationOpen"))) {
    return { error: "Registration is currently closed." };
  }

  const raw = {
    username: String(formData.get("username") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
    terms: formData.get("terms") ? "on" : undefined,
  };
  const values = { username: raw.username, email: raw.email };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  if (await getSetting("auth.termsRequired")) {
    if (!raw.terms) return { fieldErrors: { terms: "You must accept the terms to continue" }, values };
  }

  const clash = await db.user.findFirst({
    where: { OR: [{ username: parsed.data.username }, { email: parsed.data.email }] },
    select: { username: true, email: true },
  });
  if (clash) {
    return {
      fieldErrors:
        clash.username === parsed.data.username
          ? { username: "That username is taken" }
          : { email: "That email is already registered" },
      values,
    };
  }

  const [locale, currency, theme, mode, bonus] = await Promise.all([
    getSetting("locale.default"),
    getSetting("currency.display"),
    getSetting("appearance.defaultTheme"),
    getSetting("appearance.defaultColorMode"),
    getSetting("auth.signupBonus"),
  ]);

  const user = await db.user.create({
    data: {
      publicId: await nextPublicId("user"),
      username: parsed.data.username,
      email: parsed.data.email,
      password: await hashPassword(parsed.data.password),
      balance: Number(bonus) || 0,
      locale: locale as string,
      currency: currency as string,
      theme: theme as string,
      colorMode: mode === "light" ? "light" : "dark",
    },
  });

  if (Number(bonus) > 0) {
    await db.transaction.create({
      data: {
        publicId: await nextPublicId("transaction"),
        userId: user.id,
        type: "bonus",
        amount: Number(bonus),
        status: "completed",
        note: "Signup bonus",
        balanceAfter: Number(bonus),
      },
    });
  }

  await db.notification.create({
    data: {
      userId: user.id,
      title: "Welcome aboard",
      body: "Your account is ready. Top up your balance to place your first order.",
      level: "success",
      href: "/dashboard/wallet",
    },
  });

  await createSession(user.id);
  await logActivity(user.id, "register");
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
