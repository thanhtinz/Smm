import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Activity log" };

const PAGE_SIZE = 50;

/** Grouped by prefix so the filter offers areas rather than 40 exact actions. */
const AREAS = ["admin", "order", "deposit", "login", "logout", "register", "ticket"];

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; area?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);

  const q = (params.q ?? "").trim();
  const area = (params.area ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);

  const where = {
    ...(area ? { action: { startsWith: `${area}.` } } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q } },
            { detail: { contains: q } },
            { ip: { contains: q } },
            { user: { username: { contains: q } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { username: true } } },
    }),
    db.activityLog.count({ where }),
  ]);

  const fmt = { format: dates.precise };

  const href = (next: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, area, page, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== 1) sp.set(key, String(value));
    }
    const query = sp.toString();
    return `/admin/logs${query ? `?${query}` : ""}`;
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t("admin.logs")}</h2>
        <span className="muted text-sm tabular-nums">{total}</span>
      </div>

      <form className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <span className="muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2">
            <Icon name="search" size={16} />
          </span>
          <label htmlFor="q" className="sr-only">
            {t("common.search")}
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder={t("common.search")} className="field pl-11" />
        </div>
        <label htmlFor="area" className="sr-only">
          {t("admin.type")}
        </label>
        <select id="area" name="area" defaultValue={area} className="field w-auto">
          <option value="">{t("common.all")}</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-ghost">
          <Icon name="filter" size={15} />
          {t("admin.filter")}
        </button>
      </form>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="muted px-5 py-14 text-center text-sm">{t("common.none")}</p>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-44">{t("common.date")}</th>
                  <th className="w-32">{t("auth.username")}</th>
                  <th className="w-52">{t("admin.action")}</th>
                  <th>{t("admin.detail")}</th>
                  <th className="w-32">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="muted text-xs whitespace-nowrap">{fmt.format(row.createdAt)}</td>
                    <td className="text-sm">{row.user?.username ?? <span className="muted">—</span>}</td>
                    <td className="font-mono text-xs">{row.action}</td>
                    <td className="muted max-w-0 truncate text-xs" title={row.detail}>
                      {row.detail}
                    </td>
                    <td className="muted font-mono text-xs">{row.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Link
            href={href({ page: Math.max(1, page - 1) })}
            aria-disabled={page === 1}
            className={`btn btn-ghost btn-sm ${page === 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            <Icon name="arrowLeft" size={15} />
            {t("common.prev")}
          </Link>
          <span className="muted text-sm tabular-nums">
            {page} / {pages}
          </span>
          <Link
            href={href({ page: Math.min(pages, page + 1) })}
            aria-disabled={page === pages}
            className={`btn btn-ghost btn-sm ${page === pages ? "pointer-events-none opacity-50" : ""}`}
          >
            {t("common.next")}
            <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      )}
    </div>
  );
}
