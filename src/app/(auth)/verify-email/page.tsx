import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { logActivity } from "@/lib/auth";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Confirm email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const { t } = await getAppContext();

  const row = token ? await db.authToken.findUnique({ where: { token }, include: { user: true } }) : null;
  const usable = Boolean(row && row.type === "verify" && !row.usedAt && row.expiresAt > new Date());

  if (usable && row) {
    // Confirming is the whole action of this page, so it happens on load
    // rather than behind a button the mail client would have to be trusted
    // not to prefetch into a form.
    await db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await db.user.update({ where: { id: row.userId }, data: { emailVerified: true } });
    await logActivity(row.userId, "auth.verify.complete", row.user.email);
  }

  return (
    <>
      <div className={usable ? "alert alert-success" : "alert alert-warning"} role="status">
        <Icon name={usable ? "checkCircle" : "alert"} size={16} />
        <span>{usable ? t("auth.verify.done") : t("auth.verify.expired")}</span>
      </div>

      <p className="muted mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
          {t("nav.signin")}
        </Link>
      </p>
    </>
  );
}
