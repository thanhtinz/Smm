/**
 * Notifications, sent again as email.
 *
 * A notification and an email are the same sentence delivered twice, so this
 * takes no view of its own on wording: it renders the stored event exactly as
 * the bell does, in the recipient's language rather than in whoever's language
 * caused it.
 *
 * Sending happens on the sync cycle rather than where the notification is
 * written. Most of those writes sit inside a money transaction, and holding
 * one open across an SMTP round trip — or rolling a refund back because a mail
 * server was down — is not a trade worth making. The row carries mailedAt, so
 * a send that fails is retried and one that worked is never repeated.
 */

import { db } from "./db";
import { basePrisma } from "./db-base";
import { getTranslator } from "./i18n";
import { mailConfigured, mailTemplate, sendMail } from "./mail";
import { renderNotification } from "./notify";
import { getSetting } from "./settings";
import { panelBaseUrl, runAsPanel } from "./tenancy";

/**
 * Which switch decides whether an event is worth an email.
 *
 * Grouped by who reads it rather than one setting per event: an operator
 * choosing whether customers hear about refunds is making one decision, not
 * four.
 */
const AUDIENCE: Record<string, "order" | "wallet" | "support" | "admin"> = {
  "order.refunded": "order",
  "order.partial": "order",
  "request.refillApproved": "order",
  "request.refillRejected": "order",
  "request.refillCompleted": "order",
  "request.cancelApproved": "order",
  "request.cancelRejected": "order",
  "request.cancelCompleted": "order",
  "deposit.credited": "wallet",
  "balance.added": "wallet",
  "balance.adjusted": "wallet",
  "affiliate.commission": "wallet",
  "ticket.reply": "support",
  "deposit.pending": "admin",
  "provider.changes": "admin",
  "provider.change": "admin",
  "panel.rent": "admin",
  "panel.suspended": "admin",
};

/** Nothing older than this is worth mailing: it has already been read. */
const MAX_AGE_HOURS = 24;

export type MailRun = { sent: number; failures: string[] };

/**
 * One panel's unsent notifications. Runs inside that panel's context, so the
 * settings and the site name are its own.
 */
async function sendForPanel(limit: number): Promise<MailRun> {
  const out: MailRun = { sent: 0, failures: [] };
  if (!(await mailConfigured())) return out;

  const wanted = new Set<string>();
  for (const [audience, setting] of [
    ["order", "mail.onOrder"],
    ["wallet", "mail.onWallet"],
    ["support", "mail.onSupport"],
    ["admin", "mail.onAdmin"],
  ] as const) {
    if (await getSetting(setting)) wanted.add(audience);
  }
  if (wanted.size === 0) return out;

  const rows = await db.notification.findMany({
    where: {
      mailedAt: null,
      key: { not: "" },
      createdAt: { gte: new Date(Date.now() - MAX_AGE_HOURS * 3600_000) },
      // Read in the panel means read: no point in the same words arriving by
      // post afterwards.
      read: false,
      userId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { user: { select: { email: true, locale: true } } },
  });

  const url = await panelBaseUrl();
  const siteName = String(await getSetting("site.name"));
  const fallbackLocale = String(await getSetting("locale.default"));

  for (const row of rows) {
    const audience = AUDIENCE[row.key];
    if (!audience || !wanted.has(audience) || !row.user?.email) {
      // Not something this panel mails. Stamped anyway, or every pass would
      // pick the same rows up and walk past them again.
      await db.notification.update({ where: { id: row.id }, data: { mailedAt: new Date() } });
      continue;
    }

    const { t } = await getTranslator(row.user.locale || fallbackLocale);
    const { title, body } = renderNotification(row, t);

    const result = await sendMail({
      to: row.user.email,
      subject: `${title} · ${siteName}`,
      text: `${title}\n\n${body}${row.href ? `\n\n${url}${row.href}` : ""}`,
      html: mailTemplate({
        title,
        body,
        ...(row.href ? { action: { label: t("mail.open"), url: `${url}${row.href}` } } : {}),
      }),
    });

    if (result.ok) {
      await db.notification.update({ where: { id: row.id }, data: { mailedAt: new Date() } });
      out.sent += 1;
    } else {
      // Left unstamped so the next pass tries again; a mail server is often
      // only briefly unreachable.
      out.failures.push(`${row.key}: ${result.reason}`);
    }
  }

  return out;
}

/** Every panel, on the sync cycle — each with its own SMTP and its own switches. */
export async function sendPendingNotificationMails(limit = 50): Promise<MailRun> {
  const panels = await basePrisma.panel.findMany({ where: { status: "active" }, select: { id: true } });
  const out: MailRun = { sent: 0, failures: [] };

  for (const panel of panels) {
    const run = await runAsPanel(panel.id, () => sendForPanel(limit));
    out.sent += run.sent;
    out.failures.push(...run.failures);
  }
  return out;
}
