import { pageTitle } from "@/lib/page-title";
import Link from "next/link";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { panelBaseUrl } from "@/lib/tenancy";
import { regenerateApiKeyAction } from "@/app/actions/api-key";
import CopyField from "@/components/ui/copy-field";
import CallbackSettings from "@/components/api/callback-settings";
import { recentCallbacks } from "@/lib/callbacks";
import { dateFormats } from "@/lib/dates";
import { Icon } from "@/components/icons";

export const generateMetadata = pageTitle("nav.api");

export default async function ApiPage() {
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t } = ctx;

  const enabled = await getSetting("api.enabled");
  const endpoint = `${await panelBaseUrl()}/api/v2`;

  const callbacksOn = await getSetting("api.callbacksEnabled");
  const deliveries = callbacksOn ? await recentCallbacks(user.id) : [];
  const dates = dateFormats(ctx.locale, ctx.timezone);

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

      {callbacksOn && (
        <CallbackSettings
          url={user.callbackUrl}
          deliveries={deliveries.map((d) => ({
            id: d.id,
            publicId: d.publicId,
            status: d.status,
            attempts: d.attempts,
            lastCode: d.lastCode,
            lastError: d.lastError,
            at: dates.stamp(d.createdAt),
          }))}
          labels={{
            title: t("api.callback.title"),
            intro: t("api.callback.intro"),
            url: t("api.callback.url"),
            save: t("common.save"),
            saved: t("api.callback.saved"),
            recent: t("api.callback.recent"),
            attempts: t("api.callback.attempts"),
            "state.pending": t("api.callback.state.pending"),
            "state.delivered": t("api.callback.state.delivered"),
            "state.failed": t("api.callback.state.failed"),
          }}
        />
      )}

      <Link href="/api-docs" className="btn btn-ghost">
        <Icon name="document" size={16} />
        {t("api.docs")}
      </Link>
    </div>
  );
}
