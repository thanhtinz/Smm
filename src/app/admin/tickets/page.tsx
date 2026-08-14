import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/icons";
import { TICKET_PRIORITIES, TICKET_STATUSES, priorityKey, priorityTone } from "@/lib/tickets";

export const metadata: Metadata = { title: "Support" };

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; who?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const { t, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const status = TICKET_STATUSES.includes((params.status ?? "") as never) ? params.status : undefined;
  const priority = TICKET_PRIORITIES.find((p) => p.key === params.priority);
  const who = params.who === "mine" || params.who === "unclaimed" ? params.who : undefined;

  const where = {
    ...(status ? { status } : {}),
    ...(priority ? { priority: priority.value } : {}),
    ...(who === "mine" ? { assigneeId: ctx.user!.id } : {}),
    ...(who === "unclaimed" ? { assigneeId: null } : {}),
  };

  const [tickets, counts, priorityCounts, mineCount, unclaimedCount] = await Promise.all([
    db.ticket.findMany({
      where,
      // The queue order: the most urgent first, then whatever has been waiting
      // longest within that band. Closed tickets sort with everything else,
      // which is why the status tabs exist.
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        user: { select: { username: true } },
        assignee: { select: { username: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.ticket.groupBy({ by: ["status"], _count: true }),
    db.ticket.groupBy({ by: ["priority"], _count: true }),
    db.ticket.count({ where: { assigneeId: ctx.user!.id } }),
    db.ticket.count({ where: { assigneeId: null } }),
  ]);

  const fmtDate = { format: dates.stamp };
  const countFor = (value: number) => priorityCounts.find((c) => c.priority === value)?._count ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("dash.tickets")}</h2>

      <div className="scroll-x -mx-1 px-1">
        <div className="flex gap-2 pb-1">
          <Tab
            href={queryFor(undefined, params.priority, who)}
            active={!status}
            label={t("common.all")}
            count={counts.reduce((n, c) => n + c._count, 0)}
          />
          {TICKET_STATUSES.map((s) => (
            <Tab
              key={s}
              href={queryFor(s, params.priority, who)}
              active={status === s}
              label={t(`support.status.${s}`)}
              count={counts.find((c) => c.status === s)?._count ?? 0}
            />
          ))}
        </div>
      </div>

      {/* A second row rather than more tabs in the first: status and priority
          are different questions and they combine. */}
      <div className="scroll-x -mx-1 px-1">
        <div className="flex gap-2 pb-1">
          <Tab
            href={queryFor(status, undefined, who)}
            active={!priority}
            label={t("support.priority.any")}
            count={priorityCounts.reduce((n, c) => n + c._count, 0)}
            small
          />
          {[...TICKET_PRIORITIES]
            .reverse()
            .map((p) => (
              <Tab
                key={p.key}
                href={queryFor(status, p.key, who)}
                active={priority?.key === p.key}
                label={t(`support.priority.${p.key}`)}
                count={countFor(p.value)}
                small
              />
            ))}
        </div>
      </div>

      {/* Who is on it — a third question again, and it combines with the
          other two rather than replacing them. */}
      <div className="scroll-x -mx-1 px-1">
        <div className="flex gap-2 pb-1">
          <Tab
            href={queryFor(status, params.priority, undefined)}
            active={!who}
            label={t("support.assignee.any")}
            count={counts.reduce((n, c) => n + c._count, 0)}
            small
          />
          <Tab
            href={queryFor(status, params.priority, "mine")}
            active={who === "mine"}
            label={t("support.assignee.mine")}
            count={mineCount}
            small
          />
          <Tab
            href={queryFor(status, params.priority, "unclaimed")}
            active={who === "unclaimed"}
            label={t("support.assignee.unclaimed")}
            count={unclaimedCount}
            small
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {tickets.length === 0 ? (
          <p className="muted px-5 py-14 text-center text-sm">{t("common.none")}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {tickets.map((ticket) => {
              const tone = priorityTone(ticket.priority);
              return (
                <li key={ticket.id}>
                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--surface2)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {tone && (
                          <span className={`badge badge-${tone}`}>{t(`support.priority.${priorityKey(ticket.priority)}`)}</span>
                        )}
                        {ticket.subject}
                      </p>
                      <p className="muted mt-0.5 text-xs">
                        #{ticket.publicId} · {ticket.user.username} · {t(`support.category.${ticket.category}`)} ·{" "}
                        {fmtDate.format(ticket.updatedAt)}
                        {" · "}
                        <span className={ticket.assignee ? "" : "text-[var(--warning)]"}>
                          {ticket.assignee?.username ?? t("support.assignee.none")}
                        </span>
                      </p>
                    </div>
                    <span className="muted text-xs tabular-nums">{ticket._count.messages}</span>
                    <StatusBadge status={ticket.status} label={t(`support.status.${ticket.status}`)} />
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function queryFor(status?: string, priority?: string, who?: string) {
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  if (priority) sp.set("priority", priority);
  if (who) sp.set("who", who);
  const qs = sp.toString();
  return qs ? `/admin/tickets?${qs}` : "/admin/tickets";
}

function Tab({
  href,
  active,
  label,
  count,
  small,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-full border font-medium transition-colors ${
        small ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      } ${
        active
          ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
          : "muted border-[var(--border)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </Link>
  );
}
