import type { Metadata } from "next";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { otpauthUrl } from "@/lib/totp";
import { STAFF_ROLES, twoFactorRequired, unusedRecoveryCount } from "@/lib/two-factor";
import ProfileForms from "@/components/account/profile-forms";
import PreferencesPanel from "@/components/account/preferences-panel";
import TwoFactorPanel from "@/components/account/two-factor-panel";

export const metadata: Metadata = { title: "Profile" };

/**
 * Renders the QR for a secret on the server. Passed down as an action so the
 * encoder stays out of the browser bundle and the secret is drawn where it
 * already lives.
 */
async function qrFor(secret: string): Promise<{ svg: string; uri: string }> {
  "use server";
  const ctx = await getAppContext();
  const uri = otpauthUrl(secret, ctx.user!.username, String(await getSetting("site.name")));
  return { svg: await QRCode.toString(uri, { type: "svg", margin: 0, width: 180 }), uri };
}

export default async function ProfilePage() {
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t } = ctx;

  const fresh = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { fullName: true, username: true, email: true, role: true, createdAt: true, totpEnabledAt: true },
  });
  const staff = STAFF_ROLES.has(fresh.role);
  const day = new Intl.DateTimeFormat(ctx.locale === "vi" ? "vi-VN" : ctx.locale, { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.profile")}</h2>

      <ProfileForms
        username={fresh.username}
        email={fresh.email}
        fullName={fresh.fullName}
        joined={day.format(fresh.createdAt)}
        labels={{
          account: t("profile.account"),
          username: t("auth.username"),
          email: t("auth.email"),
          fullName: t("profile.fullName"),
          joined: t("profile.joined"),
          save: t("common.save"),
          saved: t("profile.saved"),
          passwordTitle: t("profile.passwordTitle"),
          passwordHint: t("profile.passwordHint"),
          current: t("profile.currentPassword"),
          password: t("auth.password"),
          confirm: t("auth.confirm"),
          changed: t("profile.passwordChanged"),
        }}
      />

      <PreferencesPanel
        languages={ctx.languages}
        currencies={ctx.currencies}
        themes={ctx.themes}
        locale={ctx.locale}
        currency={ctx.currency.code}
        theme={ctx.theme}
        allowLocale={Boolean(await getSetting("locale.allowUserLocale"))}
        allowCurrency={Boolean(await getSetting("currency.allowUserCurrency"))}
        allowTheme={Boolean(await getSetting("appearance.allowUserTheme"))}
        labels={{
          title: t("profile.preferences"),
          language: t("common.language"),
          currency: t("common.currency"),
          theme: t("common.theme"),
          fixed: t("profile.preferencesFixed"),
        }}
      />

      {/* Only staff: a customer locked out of their own wallet by a lost
          phone is a support burden the panel gains nothing from. */}
      {staff && (
        <TwoFactorPanel
          enabled={fresh.totpEnabledAt !== null}
          enabledOn={fresh.totpEnabledAt ? day.format(fresh.totpEnabledAt) : ""}
          enforced={await twoFactorRequired()}
          recoveryLeft={await unusedRecoveryCount(user.id)}
          qrFor={qrFor}
          labels={{
            title: t("auth.2fa.title"),
            off: t("auth.2fa.off"),
            on: t("auth.2fa.on"),
            enforced: t("auth.2fa.enforced"),
            start: t("auth.2fa.start"),
            scan: t("auth.2fa.scan"),
            manual: t("auth.2fa.manual"),
            code: t("auth.2fa.code"),
            codeHint: t("auth.2fa.codeHint"),
            confirm: t("auth.2fa.confirm"),
            cancel: t("common.cancel"),
            saved: t("profile.saved"),
            codesTitle: t("auth.2fa.codesTitle"),
            codesHint: t("auth.2fa.codesHint"),
            copy: t("auth.2fa.copy"),
            copied: t("auth.2fa.copied"),
            done: t("auth.2fa.done"),
            recoveryLeft: t("auth.2fa.recoveryLeft"),
            regenerate: t("auth.2fa.regenerate"),
            disable: t("auth.2fa.disable"),
            password: t("profile.currentPassword"),
            since: t("auth.2fa.since"),
          }}
        />
      )}
    </div>
  );
}
