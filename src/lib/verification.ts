import { randomBytes } from "crypto";
import { db } from "./db";
import { getSetting } from "./settings";
import { panelBaseUrl } from "./tenancy";
import { mailConfigured, mailTemplate, sendMail } from "./mail";
import { getTranslator } from "./i18n";

/**
 * Email address verification.
 *
 * Only in force when the panel asks for it AND can actually send mail —
 * otherwise every new account would be locked out by a setting nobody could
 * satisfy.
 */

export async function verificationRequired(): Promise<boolean> {
  return Boolean(await getSetting("auth.requireEmailVerification")) && (await mailConfigured());
}

export async function sendVerificationEmail(user: {
  id: string;
  email: string;
  username: string;
  /** Blank on an account that has not chosen one; the panel default then. */
  locale?: string;
}): Promise<boolean> {
  const token = randomBytes(32).toString("hex");

  // One live link at a time, so an older mail cannot be used after a newer
  // one was asked for.
  await db.authToken.updateMany({
    where: { userId: user.id, type: "verify", usedAt: null },
    data: { usedAt: new Date() },
  });
  await db.authToken.create({
    data: { userId: user.id, type: "verify", token, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) },
  });

  const url = `${await panelBaseUrl()}/verify-email?token=${token}`;
  const site = String(await getSetting("site.name"));

  // The account's own language: this arrives in an inbox, where the panel's
  // language picker is not to hand.
  const { t } = await getTranslator(user.locale || String(await getSetting("locale.default")));
  const body = t("mail.verify.body", { user: user.username });

  const result = await sendMail({
    to: user.email,
    subject: t("mail.verify.subject", { site }),
    text: `${body}\n\n${url}`,
    html: mailTemplate({
      title: t("mail.verify.title"),
      body,
      action: { label: t("mail.verify.action"), url },
    }),
  });

  return result.ok;
}
