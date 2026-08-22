import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getSetting } from "@/lib/settings";
import { panelBaseUrl } from "@/lib/tenancy";
import { authorizeUrl, isProviderKey, isUsable, redirectUri, settingKeys } from "@/lib/oauth";
import { safeNext } from "@/lib/next-path";
import { OAUTH_STATE_COOKIE, stateCookieOptions } from "@/lib/oauth-state";

/**
 * Step one: send the customer to the provider.
 *
 * The `state` is minted here and put in a short-lived, http-only cookie. The
 * callback compares the two, which is what stops an attacker from completing
 * the dance with their own account and handing the finished callback link to
 * somebody else — the browser that finishes has to be the browser that
 * started.
 *
 * Where they were headed rides along inside the state rather than in the URL,
 * so the value the callback trusts is one this panel wrote.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = await panelBaseUrl();

  if (!isProviderKey(provider)) return NextResponse.redirect(`${origin}/login?oauth=unavailable`);

  const keys = settingKeys(provider);
  const [enabled, clientId, clientSecret] = await Promise.all([
    getSetting(keys.enabled),
    getSetting(keys.clientId),
    getSetting(keys.clientSecret),
  ]);
  if (!isUsable({ enabled, clientId, clientSecret })) {
    return NextResponse.redirect(`${origin}/login?oauth=unavailable`);
  }

  const token = randomBytes(24).toString("hex");
  const next = safeNext(request.nextUrl.searchParams.get("next")) ?? "";
  const nonce = randomBytes(16).toString("hex");

  const response = NextResponse.redirect(
    authorizeUrl({
      provider,
      clientId: String(clientId),
      redirectUri: redirectUri(origin, provider),
      state: token,
      nonce,
    }),
  );
  response.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ token, provider, next }), stateCookieOptions());
  return response;
}
