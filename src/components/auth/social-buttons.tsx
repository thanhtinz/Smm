import { getSetting } from "@/lib/settings";
import { readerMessages } from "@/lib/context";
import { OAUTH_PROVIDERS, isUsable, settingKeys, type OAuthProviderKey } from "@/lib/oauth";
import { Icon } from "@/components/icons";

/**
 * The other ways in, on the sign-in and sign-up pages.
 *
 * A provider appears only when it is switched on *and* configured: a button
 * that hands the customer to an error page on Google's site is worse than no
 * button. With none configured this renders nothing at all — no divider, no
 * empty row — so a panel that never sets this up looks exactly as it did.
 */
export default async function SocialButtons({ next = "" }: { next?: string }) {
  const t = await readerMessages();

  const usable: OAuthProviderKey[] = [];
  for (const provider of OAUTH_PROVIDERS) {
    const keys = settingKeys(provider);
    const [enabled, clientId, clientSecret] = await Promise.all([
      getSetting(keys.enabled),
      getSetting(keys.clientId),
      getSetting(keys.clientSecret),
    ]);
    if (isUsable({ enabled, clientId, clientSecret })) usable.push(provider);
  }

  if (usable.length === 0) return null;

  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="divider flex-1" />
        <span className="muted text-xs uppercase tracking-wide">{t("auth.or")}</span>
        <span className="divider flex-1" />
      </div>

      <div className="mt-4 grid gap-2">
        {usable.map((provider) => (
          <a key={provider} href={`/auth/oauth/${provider}${query}`} className="btn btn-ghost w-full">
            <Icon name={provider} size={17} />
            {t(`auth.with.${provider}`)}
          </a>
        ))}
      </div>
    </div>
  );
}
