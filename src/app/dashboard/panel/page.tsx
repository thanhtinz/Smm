import { pageTitle } from "@/lib/page-title";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import { displayMoney } from "@/lib/currency";
import { getCurrentPanel } from "@/lib/tenancy";
import { effectiveMaxDepth } from "@/lib/panels";
import PanelRequestForm from "@/components/panels/panel-request-form";
import { Icon } from "@/components/icons";

export const generateMetadata = pageTitle("nav.ownPanel");

/**
 * Asking for a panel of your own.
 *
 * The whole flow lives on one page because it is one wait: fill this in,
 * point your nameservers, and watch this line change. Splitting it across a
 * request page and a status page would mean the reseller checking two places
 * to learn one thing.
 */
export default async function OwnPanelPage() {
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t, currency, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const parent = await getCurrentPanel();
  const [children, selfServe, rentPrice, rentDays] = await Promise.all([
    getSetting("panel.childrenEnabled"),
    getSetting("panel.selfServeEnabled"),
    getSetting("panel.rentPrice"),
    getSetting("panel.rentPeriodDays"),
  ]);

  const maxDepth = parent ? await effectiveMaxDepth(parent) : 0;
  const roomBelow = !parent || maxDepth <= 0 || parent.depth + 1 <= maxDepth;

  if (!children || !selfServe || !roomBelow) {
    return (
      <div className="alert alert-info mx-auto max-w-2xl" role="status">
        <Icon name="info" size={16} />
        <span>{t("panelReq.closed")}</span>
      </div>
    );
  }

  const requests = await db.panelRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const open = requests.find((r) => r.status === "pending" || r.status === "delegated");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("panelReq.title")}</h2>
        <p className="muted mt-2 text-sm">{t("panelReq.intro")}</p>
      </div>

      <PanelRequestForm
        open={
          open && {
            id: open.id,
            publicId: open.publicId,
            name: open.name,
            host: open.host,
            status: open.status,
            nameServers: open.nameServers ? open.nameServers.split(",") : [],
            note: open.note,
          }
        }
        history={requests
          .filter((r) => r.id !== open?.id)
          .map((r) => ({
            id: r.id,
            publicId: r.publicId,
            host: r.host,
            status: r.status,
            note: r.note,
            at: dates.full(r.createdAt),
          }))}
        rent={
          Number(rentPrice) > 0
            ? t("panelReq.rent", {
                amount: displayMoney(Number(rentPrice), currency, locale),
                days: Number(rentDays) || 30,
              })
            : ""
        }
        labels={{
          name: t("panelReq.name"),
          nameHint: t("panelReq.nameHint"),
          slug: t("admin.slug"),
          slugHint: t("panelReq.slugHint"),
          host: t("panelReq.host"),
          hostHint: t("panelReq.hostHint"),
          submit: t("panelReq.submit"),
          waiting: t("panelReq.waiting"),
          delegated: t("panelReq.delegated"),
          nameServers: t("panelReq.nameServers"),
          nameServersHint: t("panelReq.nameServersHint"),
          recheck: t("panelReq.recheck"),
          history: t("panelReq.history"),
          copy: t("common.copy"),
          copied: t("common.copied"),
          status: {
            pending: t("panelReq.status.pending"),
            delegated: t("panelReq.status.delegated"),
            approved: t("panelReq.status.approved"),
            rejected: t("panelReq.status.rejected"),
          },
        }}
      />
    </div>
  );
}
