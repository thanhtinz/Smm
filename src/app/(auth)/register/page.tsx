import type { Metadata } from "next";
import RegisterForm from "@/components/auth/register-form";
import { getAppContext } from "@/lib/context";
import { captchaFor } from "@/lib/captcha";
import { getSetting } from "@/lib/settings";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const { t } = await getAppContext();
  const [open, termsRequired] = await Promise.all([
    getSetting("auth.registrationOpen"),
    getSetting("auth.termsRequired"),
  ]);

  if (!open) {
    return (
      <div className="alert alert-info" role="status">
        <Icon name="info" size={16} />
        <span>Registration is closed at the moment. Please check back later.</span>
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
        email: t("auth.email"),
        password: t("auth.password"),
        confirm: t("auth.confirm"),
        terms: t("auth.terms"),
        submit: t("nav.signup"),
        hasaccount: t("auth.hasaccount"),
        signin: t("nav.signin"),
        referred: t("auth.referred"),
      }}
    />
  );
}
