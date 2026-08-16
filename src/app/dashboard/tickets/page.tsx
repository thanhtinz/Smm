import { pageTitle } from "@/lib/page-title";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import NewTicketForm from "@/components/tickets/new-ticket-form";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/icons";

export const generateMetadata = pageTitle("dash.tickets");

export default async function TicketsPage() {
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const [enabled, categories, tickets] = await Promise.all([
    getSetting("support.enabled"),
    getSetting("support.categories"),
    db.ticket.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
    }),
  ]);

  const fmtDate = { format: dates.stamp };

  const labels: Record<string, string> = {
    category: t("support.category"),
    subject: t("support.subject"),
    message: t("support.message"),
    submit: t("support.submit"),
  };
  const categoryList = [...(categories as readonly string[])];
  for (const c of categoryList) labels[`category.${c}`] = t(`support.category.${c}`);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("dash.tickets")}</h2>

      {!enabled ? (
        <div className="alert alert-info" role="status">
          <Icon name="info" size={16} />
          <span>{t("support.disabled")}</span>
        </div>
      ) : (
        <NewTicketForm categories={categoryList} labels={labels} />
      )}

      <div className="card overflow-hidden">
        {tickets.length === 0 ? (
          <p className="muted px-5 py-12 text-center text-sm">{t("common.none")}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link href={`/dashboard/tickets/${ticket.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--surface2)]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ticket.subject}</p>
                    <p className="muted mt-0.5 text-xs">
                      #{ticket.publicId} · {ticket._count.messages} · {fmtDate.format(ticket.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} label={t(`support.status.${ticket.status}`)} />
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
