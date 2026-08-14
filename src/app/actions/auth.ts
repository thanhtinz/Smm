"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, logActivity, verifyPassword } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { nextPublicId } from "@/lib/ids";
import { findReferrerByCode } from "@/lib/affiliate";
import { verifyCaptcha } from "@/lib/captcha";
import { sendVerificationEmail, verificationRequired } from "@/lib/verification";
import { startPendingLogin, twoFactorActive } from "@/lib/two-factor";
import { notification } from "@/lib/notify";

export type FormState = {
  error?: string;
  /** Set when sign-in is blocked only because the address is unconfirmed. */
  unverified?: string;
  /** Set when sign-up finished but the account still needs confirming. */
  pendingVerification?: string;
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

  // Before the password is checked, so a failed captcha costs an attacker a
  // round trip without telling them anything about the account.
  if (!(await verifyCaptcha("login", formData))) {
    return { error: "Please complete the verification and try again.", values: { identifier: raw.identifier } };
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
  // Checked after the password, so an unverified address is only revealed to
  // someone who already knows the credentials.
  if (!user.emailVerified && (await verificationRequired())) {
    return { unverified: user.email, values: { identifier: raw.identifier } };
  }

  // A staff account with a second factor gets no session yet — only a ticket
  // that is worth nothing without the code.
  if (twoFactorActive(user)) {
    await startPendingLogin(user.id);
    await logActivity(user.id, "login.2fa.pending");
    redirect("/two-factor");
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

  if (!(await verifyCaptcha("register", formData))) {
    return { error: "Please complete the verification and try again." };
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

  // A referral code is only honoured at signup; it cannot be attached later.
  const referrer = await findReferrerByCode(String(formData.get("ref") ?? ""));

  const user = await db.user.create({
    data: {
      publicId: await nextPublicId("user"),
      referredById: referrer?.id ?? null,
      username: parsed.data.username,
      email: parsed.data.email,
      password: await hashPassword(parsed.data.password),
      balance: Number(bonus) || 0,
      locale: locale as string,
      currency: currency as string,
      theme: theme as string,
      colorMode: String(mode) === "light" ? "light" : "dark",
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
    data: notification({ userId: user.id, key: "welcome", level: "success", href: "/dashboard/wallet" }),
  });

  await logActivity(user.id, "register");

  // An unconfirmed account gets no session: the confirmation link is what
  // finishes signing up.
  if (await verificationRequired()) {
    await sendVerificationEmail(user);
    return { pendingVerification: user.email };
  }

  await createSession(user.id);
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

/**
 * Sends the confirmation link again.
 *
 * Answers the same whatever it finds: this form is reachable without signing
 * in, so it must not report which addresses exist or which are confirmed.
 */
export async function resendVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { fieldErrors: { email: "Enter your email address" } };

  if (await verificationRequired()) {
    const user = await db.user.findFirst({ where: { email, emailVerified: false, banned: false } });
    if (user) await sendVerificationEmail(user);
  }

  return { pendingVerification: email };
}
