import nodemailer from "nodemailer";
import { getSettings } from "./settings";

/**
 * Outgoing email.
 *
 * Every panel has its own SMTP settings, because a reseller sends from their
 * own brand — the same reason branding and payment credentials are per panel.
 */

export type MailResult = { ok: true } | { ok: false; reason: string };

export type Mail = { to: string; subject: string; text: string; html?: string };

export async function mailConfigured(): Promise<boolean> {
  const s = await getSettings();
  return Boolean(s["mail.enabled"] && String(s["mail.host"] ?? "").trim() && String(s["mail.fromAddress"] ?? "").trim());
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  const s = await getSettings();
  if (!s["mail.enabled"]) return { ok: false, reason: "email is switched off" };

  const host = String(s["mail.host"] ?? "").trim();
  const from = String(s["mail.fromAddress"] ?? "").trim();
  if (!host || !from) return { ok: false, reason: "email is not configured" };

  const user = String(s["mail.user"] ?? "").trim();
  const password = String(s["mail.password"] ?? "");

  const transport = nodemailer.createTransport({
    host,
    port: Number(s["mail.port"]) || 587,
    secure: Boolean(s["mail.secure"]),
    // A relay on the same host often needs neither, and passing empty
    // credentials makes nodemailer attempt AUTH against a server that has none.
    ...(user ? { auth: { user, pass: password } } : {}),
  });

  const fromName = String(s["mail.fromName"] ?? "").trim() || String(s["site.name"] ?? "");

  try {
    await transport.sendMail({
      from: fromName ? `"${fromName}" <${from}>` : from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "send failed" };
  }
}

/**
 * A plain, readable message body.
 *
 * Deliberately simple markup: transactional mail is read in clients that
 * discard most CSS, and a link that survives everywhere beats a design that
 * does not.
 */
export function mailTemplate(opts: { title: string; body: string; action?: { label: string; url: string } }): string {
  const action = opts.action
    ? `<p style="margin:24px 0"><a href="${opts.action.url}" style="background:#6366f1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${opts.action.label}</a></p>
       <p style="color:#666;font-size:13px;word-break:break-all">${opts.action.url}</p>`
    : "";

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;line-height:1.6">
  <h1 style="font-size:20px;margin:0 0 12px">${opts.title}</h1>
  <p style="margin:0">${opts.body}</p>
  ${action}
</div>`;
}
