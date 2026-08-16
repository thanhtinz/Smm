import { pageTitle } from "@/lib/page-title";
import { redirect } from "next/navigation";
import RegisterForm from "@/components/auth/register-form";
import { getAppContext } from "@/lib/context";
import { captchaFor } from "@/lib/captcha";
import { getSetting } from "@/lib/settings";
import { Icon } from "@/components/icons";

export const generateMetadata = pageTitle("nav.signup");

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const ctx = await getAppContext();
  if (ctx.user) redirect(ctx.user.role === "admin" ? "/admin" : "/dashboard");
  const { t } = ctx;
  const [open, termsRequired] = await Promise.all([
    getSetting("auth.registrationOpen"),
    getSetting("auth.termsRequired"),
  ]);

  if (!open) {
    return (
      <div className="alert alert-info" role="status">
        <Icon name="info" size={16} />
        <span>{t("auth.registrationClosed")}</span>
      </div>
    );
  }

  return (
    <RegisterForm
      captcha={await captchaFor("register")}
      referralCode={(ref ?? "").trim().toUpperCase()}
      termsRequired={Boolean(termsRequired)}
      labels={{
        title: t("auth.signup.title"),
        sub: t("auth.signup.sub"),
        username: t("auth.username"),
        usernameHint: t("auth.usernameHint"),
        passwordHint: t("auth.passwordHint"),
        email: t("auth.email"),
        password: t("auth.password"),
        confirm: t("auth.confirm"),
        terms: t("auth.terms"),
        termsLink: t("auth.termsLink"),
        submit: t("nav.signup"),
        hasaccount: t("auth.hasaccount"),
        signin: t("nav.signin"),
        referred: t("auth.referred"),
        checkInbox: t("auth.verify.checkInbox"),
        sentTo: t("auth.verify.sentTo"),
      }}
    />
  );
}
