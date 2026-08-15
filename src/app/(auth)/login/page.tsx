import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/login-form";
import { getAppContext } from "@/lib/context";
import { captchaFor } from "@/lib/captcha";
import { safeNext } from "@/lib/next-path";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; next?: string }>;
}) {
  const { reset, next } = await searchParams;
  const ctx = await getAppContext();
  // Where they were headed when they were stopped, if it is a page on this
  // site. Checked here as well as in the action: a link that cannot be
  // honoured should not put a hidden field on the form at all.
  const wanted = safeNext(next);
  // Someone already signed in has no use for a sign-in form.
  if (ctx.user) redirect(wanted ?? (ctx.user.role === "admin" ? "/admin" : "/dashboard"));
  const { t } = ctx;

  return (
    <LoginForm
      next={wanted ?? ""}
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
