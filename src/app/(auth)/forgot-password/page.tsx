import type { Metadata } from "next";
import { getAppContext } from "@/lib/context";
import { captchaFor } from "@/lib/captcha";
import { mailConfigured } from "@/lib/mail";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const { t } = await getAppContext();

  if (!(await mailConfigured())) {
    return (
      <div className="alert alert-info" role="status">
        <Icon name="info" size={16} />
        <span>{t("auth.reset.unavailable")}</span>
      </div>
    );
  }

  return (
    <ForgotPasswordForm
      captcha={await captchaFor("login")}
      labels={{
        title: t("auth.reset.title"),
        sub: t("auth.reset.sub"),
        email: t("auth.email"),
        submit: t("auth.reset.submit"),
        sent: t("auth.reset.sent"),
        back: t("nav.signin"),
      }}
    />
  );
}
