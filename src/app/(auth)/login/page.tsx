import type { Metadata } from "next";
import LoginForm from "@/components/auth/login-form";
import { getAppContext } from "@/lib/context";
import { captchaFor } from "@/lib/captcha";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const { t } = await getAppContext();
  return (
    <LoginForm
      captcha={await captchaFor("login")}
      labels={{
        title: t("auth.signin.title"),
        sub: t("auth.signin.sub"),
        identifier: t("auth.username"),
        password: t("auth.password"),
        remember: t("auth.remember"),
        forgot: t("auth.forgot"),
        submit: t("nav.signin"),
        noaccount: t("auth.noaccount"),
        signup: t("nav.signup"),
      }}
    />
  );
}
