import { pageTitle } from "@/lib/page-title";
import { getAppContext } from "@/lib/context";
import ResendVerificationForm from "@/components/auth/resend-verification-form";

export const generateMetadata = pageTitle("auth.verify.resendTitle");

export default async function ResendVerificationPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const { t } = await getAppContext();

  return (
    <ResendVerificationForm
      email={(email ?? "").trim()}
      labels={{
        title: t("auth.verify.resendTitle"),
        sub: t("auth.verify.resendSub"),
        email: t("auth.email"),
        submit: t("auth.verify.resend"),
        sent: t("auth.verify.sentTo"),
        back: t("nav.signin"),
      }}
    />
  );
}
