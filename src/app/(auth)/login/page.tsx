import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/login-form";
import { getAppContext } from "@/lib/context";
import { captchaFor } from "@/lib/captcha";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  const ctx = await getAppContext();
  // Someone already signed in has no use for a sign-in form.
  if (ctx.user) redirect(ctx.user.role === "admin" ? "/admin" : "/dashboard");
  const { t } = ctx;

  return (
    <LoginForm
      notice={reset ? t("auth.reset.done") : ""}
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
        unverified: t("auth.verify.blocked"),
        resend: t("auth.verify.resend"),
      }}
    />
  );
}
