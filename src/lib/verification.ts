import { randomBytes } from "crypto";
import { db } from "./db";
import { getSetting } from "./settings";
import { panelBaseUrl } from "./tenancy";
import { mailConfigured, mailTemplate, sendMail } from "./mail";

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

export async function sendVerificationEmail(user: { id: string; email: string; username: string }): Promise<boolean> {
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

  const result = await sendMail({
    to: user.email,
    subject: `Confirm your email for ${site}`,
    text: `Hello ${user.username},\n\nConfirm this address to finish setting up your account. The link is good for 24 hours.\n\n${url}`,
    html: mailTemplate({
      title: "Confirm your email",
      body: `Hello ${user.username}, confirm this address to finish setting up your account. The link is good for 24 hours.`,
      action: { label: "Confirm my email", url },
    }),
  });

  return result.ok;
}
