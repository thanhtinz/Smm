import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/context";
import { pendingLogin, unusedRecoveryCount } from "@/lib/two-factor";
import ChallengeForm from "@/components/auth/two-factor-challenge";

export const metadata: Metadata = { title: "Two-step verification" };

export default async function TwoFactorPage() {
  const row = await pendingLogin();
  if (!row) redirect("/login");

  const { t } = await getAppContext();

  return (
    <ChallengeForm
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
