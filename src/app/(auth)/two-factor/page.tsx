import { pageTitle } from "@/lib/page-title";
import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/context";
import { pendingLogin, unusedRecoveryCount } from "@/lib/two-factor";
import ChallengeForm from "@/components/auth/two-factor-challenge";
import { safeNext } from "@/lib/next-path";

export const generateMetadata = pageTitle("auth.2fa.title");

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const row = await pendingLogin();
  if (!row) redirect("/login");

  const { t } = await getAppContext();

  return (
    <ChallengeForm
      next={safeNext(next) ?? ""}
      username={row.user.username}
      recoveryLeft={await unusedRecoveryCount(row.userId)}
      labels={{
        title: t("auth.2fa.challengeTitle"),
        sub: t("auth.2fa.challengeSub"),
        code: t("auth.2fa.code"),
        codeHint: t("auth.2fa.codeHint"),
        submit: t("auth.2fa.verify"),
        cancel: t("common.cancel"),
        recoveryLeft: t("auth.2fa.recoveryLeft"),
        noRecovery: t("auth.2fa.noRecovery"),
      }}
    />
  );
}
