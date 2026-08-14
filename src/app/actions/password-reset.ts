"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { destroySessionsFor, hashPassword, logActivity } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { panelBaseUrl } from "@/lib/tenancy";
import { mailConfigured, mailTemplate, sendMail } from "@/lib/mail";
import { verifyCaptcha } from "@/lib/captcha";
import { readerMessages } from "@/lib/context";

export type ResetState = { error?: string; sent?: true; fieldErrors?: Record<string, string> };

/**
 * Starts a password reset.
 *
 * Always answers the same whether or not the address is on file: the form
 * would otherwise tell a stranger which addresses have accounts. That means
 * the caller cannot know if a mail went out, which is the point.
 */
export async function requestPasswordResetAction(_prev: ResetState, form: FormData): Promise<ResetState> {
  const t = await readerMessages();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { fieldErrors: { email: t("err.emailOnAccount") } };
  }

  if (!(await verifyCaptcha("login", form))) {
    return { error: t("err.captcha") };
  }

  if (!(await mailConfigured())) {
    return { error: t("err.resetUnavailable") };
  }

  const user = await db.user.findFirst({ where: { email, banned: false } });
  if (user) {
    const minutes = Math.max(5, Number(await getSetting("mail.resetWindowMinutes")) || 60);
    const token = randomBytes(32).toString("hex");

    // Any earlier reset link stops working, so a forwarded old email cannot be
    // used after a newer one was requested.
    await db.authToken.updateMany({
      where: { userId: user.id, type: "reset", usedAt: null },
      data: { usedAt: new Date() },
    });
    await db.authToken.create({
      data: {
        userId: user.id,
        type: "reset",
        token,
        expiresAt: new Date(Date.now() + minutes * 60_000),
      },
    });

    const url = `${await panelBaseUrl()}/reset-password?token=${token}`;
    const site = String(await getSetting("site.name"));
    await sendMail({
      to: user.email,
      subject: `Reset your ${site} password`,
      text: `Open this link to set a new password. It expires in ${minutes} minutes.\n\n${url}\n\nIf you did not ask for this, nothing has changed and you can ignore this email.`,
      html: mailTemplate({
        title: "Set a new password",
        body: `This link expires in ${minutes} minutes. If you did not ask for it, nothing has changed and you can ignore this email.`,
        action: { label: "Set a new password", url },
      }),
    });

    await logActivity(user.id, "auth.reset.request", email);
  }

  return { sent: true };
}

export async function completePasswordResetAction(_prev: ResetState, form: FormData): Promise<ResetState> {
  const t = await readerMessages();
  const token = String(form.get("token") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (password.length < 8) return { fieldErrors: { password: t("err.passwordLength") } };
  if (password !== confirm) return { fieldErrors: { confirm: t("err.passwordMatch") } };

  const row = token ? await db.authToken.findUnique({ where: { token }, include: { user: true } }) : null;
  if (!row || row.type !== "reset" || row.usedAt || row.expiresAt < new Date()) {
    return { error: t("err.linkUsed") };
  }

  await db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  await db.user.update({ where: { id: row.userId }, data: { password: await hashPassword(password) } });

  // Whoever knew the old password is signed out: a reset is what someone does
  // when they think an account has been reached by somebody else.
  await destroySessionsFor(row.userId);
  await logActivity(row.userId, "auth.reset.complete", row.user.email);

  redirect("/login?reset=1");
}
