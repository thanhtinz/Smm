import { pageTitle } from "@/lib/page-title";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import ResetPasswordForm from "@/components/auth/reset-password-form";
import { Icon } from "@/components/icons";

export const generateMetadata = pageTitle("auth.reset.newTitle");

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const { t } = await getAppContext();

  // Checked before the form is drawn, so a dead link says so rather than
  // asking for a password and refusing it afterwards.
  const row = token ? await db.authToken.findUnique({ where: { token } }) : null;
  const usable = Boolean(row && row.type === "reset" && !row.usedAt && row.expiresAt > new Date());

  if (!usable) {
    return (
      <div className="alert alert-warning" role="status">
        <Icon name="alert" size={16} />
        <span>{t("auth.reset.expired")}</span>
      </div>
    );
  }

  return (
    <ResetPasswordForm
      token={token!}
      labels={{
        title: t("auth.reset.newTitle"),
        sub: t("auth.reset.newSub"),
        password: t("auth.password"),
        confirm: t("auth.confirm"),
        submit: t("auth.reset.save"),
      }}
    />
  );
}
