import { getSetting } from "./settings";

/**
 * Captcha on the sign-in and sign-up forms.
 *
 * The three providers here share a shape — a script that renders a widget and
 * posts a token into a named field, and a POST that verifies the token against
 * a shared secret — so they differ only by their URLs and field name.
 */

export type CaptchaProvider = {
  /** Script the browser loads to draw the widget. */
  script: string;
  /** Where the token is verified, server to server. */
  verify: string;
  /** Form field the widget writes its token into. */
  field: string;
  /** Class the widget attaches itself to. */
  className: string;
};

export const CAPTCHA_PROVIDERS: Record<string, CaptchaProvider> = {
  turnstile: {
    script: "https://challenges.cloudflare.com/turnstile/v0/api.js",
    verify: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    field: "cf-turnstile-response",
    className: "cf-turnstile",
  },
  hcaptcha: {
    script: "https://js.hcaptcha.com/1/api.js",
    verify: "https://api.hcaptcha.com/siteverify",
    field: "h-captcha-response",
    className: "h-captcha",
  },
  recaptcha: {
    script: "https://www.google.com/recaptcha/api.js",
    verify: "https://www.google.com/recaptcha/api/siteverify",
    field: "g-recaptcha-response",
    className: "g-recaptcha",
  },
};

export type CaptchaConfig = { provider: string; siteKey: string; className: string; script: string } | null;

/**
 * What the form needs to draw a widget, or null when captcha is off, not
 * configured, or not wanted on this form.
 */
export async function captchaFor(form: "login" | "register"): Promise<CaptchaConfig> {
  const provider = String(await getSetting("auth.captchaProvider"));
  const spec = CAPTCHA_PROVIDERS[provider];
  if (!spec) return null;

  const siteKey = String(await getSetting("auth.captchaSiteKey")).trim();
  const secret = String(await getSetting("auth.captchaSecret")).trim();
  // Half-configured is off: a widget with no secret behind it is decoration.
  if (!siteKey || !secret) return null;

  const wanted = await getSetting(form === "login" ? "auth.captchaOnLogin" : "auth.captchaOnRegister");
  if (!wanted) return null;

  return { provider, siteKey, className: spec.className, script: spec.script };
}

/**
 * Checks the token the widget produced.
 *
 * Fails closed. A provider that cannot be reached, or a reply that is not what
 * we expect, is a failed check — the alternative is that an outage silently
 * turns the captcha off, which is when it matters most.
 */
export async function verifyCaptcha(form: "login" | "register", data: FormData): Promise<boolean> {
  const config = await captchaFor(form);
  if (!config) return true;

  const spec = CAPTCHA_PROVIDERS[config.provider];
  const token = String(data.get(spec.field) ?? "").trim();
  if (!token) return false;

  const secret = String(await getSetting("auth.captchaSecret")).trim();
  const body = new URLSearchParams({ secret, response: token });

  try {
    const res = await fetch(spec.verify, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    const result = (await res.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
