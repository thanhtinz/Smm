import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { panelBaseUrl } from "@/lib/tenancy";
import { createSession, logActivity } from "@/lib/auth";
import { nextPublicId } from "@/lib/ids";
import { notification } from "@/lib/notify";
import { OAUTH_ENDPOINTS, isProviderKey, isUsable, normaliseProfile, redirectUri, settingKeys, usernameFrom } from "@/lib/oauth";
import { OAUTH_STATE_COOKIE, parseState } from "@/lib/oauth-state";
import { safeNext } from "@/lib/next-path";
import { startPendingLogin, twoFactorActive } from "@/lib/two-factor";
import { randomBytes } from "crypto";
import { hashPassword } from "@/lib/auth";

/**
 * Step two: the provider sends the customer back.
 *
 * Everything here is refused by default. The browser must be the one that
 * started; the provider must be one this panel offers and has credentials
 * for; the answer must carry a permanent id and an address the provider says
 * it has confirmed. A failure sends them back to the sign-in page with a
 * reason, never with a detail from the provider — those are for the log.
 */

const TIMEOUT_MS = 15_000;

/** Every way out of here that is not a signed-in customer. */
function refuse(origin: string, reason: string) {
  const response = NextResponse.redirect(`${origin}/login?oauth=${reason}`);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

async function post(url: string, body: URLSearchParams): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function get(url: string, accessToken: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = await panelBaseUrl();

  if (!isProviderKey(provider)) return refuse(origin, "unavailable");

  // The browser that finishes has to be the browser that started, and it has
  // to be finishing the provider it started with.
  const state = parseState(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const returned = request.nextUrl.searchParams.get("state") ?? "";
  if (!state || state.provider !== provider || !returned || returned !== state.token) {
    return refuse(origin, "expired");
  }

  // The customer pressed cancel at the provider. Not an error worth a scare.
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!code) return refuse(origin, "cancelled");

  const keys = settingKeys(provider);
  const [enabled, clientId, clientSecret] = await Promise.all([
    getSetting(keys.enabled),
    getSetting(keys.clientId),
    getSetting(keys.clientSecret),
  ]);
  if (!isUsable({ enabled, clientId, clientSecret })) return refuse(origin, "unavailable");

  const endpoints = OAUTH_ENDPOINTS[provider];
  const token = (await post(
    endpoints.tokenUrl,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: String(clientId),
      client_secret: String(clientSecret),
      redirect_uri: redirectUri(origin, provider),
    }),
  )) as { access_token?: string } | null;

  const accessToken = String(token?.access_token ?? "");
  if (!accessToken) return refuse(origin, "failed");

  const profile = normaliseProfile(provider, await get(endpoints.profileUrl, accessToken));
  // No permanent id, or an address the provider has not confirmed. Matching an
  // account on an unconfirmed address is how one person signs in as another.
  if (!profile) return refuse(origin, "noemail");

  // Already linked: the id is what is trusted, not the address, so changing
  // the email at Google does not lock anybody out.
  const linked = await db.oAuthAccount.findFirst({
    where: { provider, providerAccountId: profile.providerAccountId },
    include: { user: true },
  });

  let user = linked?.user ?? null;

  if (!user) {
    // Same address, signed up the ordinary way. Link rather than refuse: the
    // provider has confirmed the address, which is the same proof the
    // verification email asks for.
    const existing = await db.user.findFirst({ where: { email: profile.email } });

    if (existing) {
      user = existing;
      await db.oAuthAccount.create({
        data: { userId: existing.id, provider, providerAccountId: profile.providerAccountId, email: profile.email },
      });
      if (!existing.emailVerified) {
        await db.user.update({ where: { id: existing.id }, data: { emailVerified: true } });
      }
      await logActivity(existing.id, "oauth.link", provider);
    } else {
      if (!(await getSetting("auth.registrationOpen"))) return refuse(origin, "closed");
      user = await createFromProfile(provider, profile);
    }
  }

  if (user.banned) return refuse(origin, "banned");

  // A second factor is a second factor however the first one was proved.
  if (twoFactorActive(user)) {
    await startPendingLogin(user.id);
    await logActivity(user.id, "login.2fa.pending");
    const response = NextResponse.redirect(
      `${origin}/two-factor${state.next ? `?next=${encodeURIComponent(state.next)}` : ""}`,
    );
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  await createSession(user.id);
  await logActivity(user.id, "login.success", provider);

  const wanted = safeNext(state.next);
  const response = NextResponse.redirect(
    `${origin}${wanted ?? (user.role === "admin" ? "/admin" : "/dashboard")}`,
  );
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

/**
 * A new account, on the same terms as one made through the form.
 *
 * Same signup bonus, same welcome, same defaults — the only differences are
 * that the address arrives already confirmed and that the password is a random
 * string nobody holds, so the account can only be reached the way it was made
 * until its owner sets one through the reset flow.
 */
async function createFromProfile(
  provider: string,
  profile: { providerAccountId: string; email: string; name: string },
) {
  const [locale, currency, theme, mode, bonus] = await Promise.all([
    getSetting("locale.default"),
    getSetting("currency.display"),
    getSetting("appearance.defaultTheme"),
    getSetting("appearance.defaultColorMode"),
    getSetting("auth.signupBonus"),
  ]);

  // Candidates are checked against this panel's users only, which is what the
  // tenant filter on `db` already guarantees.
  const near = await db.user.findMany({
    where: { username: { startsWith: (profile.email.split("@")[0] ?? "").replace(/[^A-Za-z0-9_]+/g, "").slice(0, 24) } },
    select: { username: true },
  });
  const taken = new Set(near.map((u) => u.username));
  const username = usernameFrom(profile.email, (candidate) => taken.has(candidate));

  const user = await db.user.create({
    data: {
      publicId: await nextPublicId("user"),
      username,
      email: profile.email,
      // Not a password anybody knows, including us.
      password: await hashPassword(randomBytes(32).toString("hex")),
      fullName: profile.name,
      emailVerified: true,
      balance: Number(bonus) || 0,
      locale: locale as string,
      currency: currency as string,
      theme: theme as string,
      colorMode: String(mode) === "light" ? "light" : "dark",
    },
  });

  // A separate call rather than a nested create: nested writes do not pass
  // through the panel filter, so the link would be written with a blank
  // panelId and the next sign-in would not find it.
  await db.oAuthAccount.create({
    data: { userId: user.id, provider, providerAccountId: profile.providerAccountId, email: profile.email },
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
  await logActivity(user.id, "register", provider);

  return user;
}
