import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { panelBaseUrl } from "@/lib/tenancy";
import { regenerateApiKeyAction } from "@/app/actions/api-key";
import CopyField from "@/components/ui/copy-field";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "API" };

export default async function ApiPage() {
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t } = ctx;

  const enabled = await getSetting("api.enabled");
  const endpoint = `${await panelBaseUrl()}/api/v2`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.api")}</h2>

      {!enabled && (
        <div className="alert alert-warning" role="status">
          <Icon name="alert" size={16} />
          <span>{t("api.disabled")}</span>
        </div>
      )}

      <div className="card card-pad space-y-3">
        <CopyField
          label={t("api.endpoint")}
          value={endpoint}
          copyLabel={t("wallet.copy")}
          copiedLabel={t("wallet.copied")}
          mono
        />
        <CopyField
          label={t("api.key")}
          value={user.apiKey}
          copyLabel={t("wallet.copy")}
          copiedLabel={t("wallet.copied")}
          mono
          highlight
        />

        <form action={regenerateApiKeyAction}>
          <button type="submit" className="btn btn-danger btn-sm">
            <Icon name="refresh" size={15} />
            {t("api.rotate")}
          </button>
        </form>
        <p className="form-hint">{t("api.rotateHint")}</p>
      </div>

      <Link href="/api-docs" className="btn btn-ghost">
        <Icon name="document" size={16} />
        {t("api.docs")}
      </Link>
    </div>
  );
}
