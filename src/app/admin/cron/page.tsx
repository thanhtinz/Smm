import type { Metadata } from "next";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { panelBaseUrl, getRootPanel, currentPanelId } from "@/lib/tenancy";
import { syncHealth } from "@/lib/sync-health";
import { CRON_JOBS } from "@/lib/cron-jobs";
import { basePrisma } from "@/lib/db-base";
import CronManager from "@/components/admin/cron-manager";
import CopyField from "@/components/ui/copy-field";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Scheduler" };

/**
 * Everything about the thing that makes the panel run by itself.
 *
 * The panel does not schedule itself — it exposes one endpoint and something
 * outside has to call it. That is the correct shape for a web app, but it left
 * the setup invisible: the URL was in nobody's documentation, the secret was
 * an environment variable, and whether anything was calling at all could only
 * be inferred from a line on the overview. This page is that setup, the
 * evidence it is working, and a button per job for when it is not.
 */
export default async function AdminCronPage() {
  const ctx = await getAppContext();
  const { t, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const [health, root, panelId, base] = await Promise.all([
    syncHealth(),
    getRootPanel(),
    currentPanelId(),
    panelBaseUrl(),
  ]);
  const isRoot = Boolean(root && root.id === panelId);

  // One cycle covers every panel, so only the root's operator configures it.
  const url = `${base}/api/cron/sync`;
  const configured = Boolean(process.env.CRON_SECRET);
  const recent = await basePrisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 8 });

  const labels: Record<string, string> = {
    jobs: t("cron.jobs"),
    jobsHint: t("cron.jobsHint"),
    run: t("cron.run"),
    runAll: t("cron.runAll"),
    done: t("cron.done"),
    "moves.money": t("cron.moves.money"),
    "moves.orders": t("cron.moves.orders"),
  };
  for (const job of CRON_JOBS) {
    labels[`job.${job.key}`] = t(`cron.job.${job.key}`);
    labels[`jobHint.${job.key}`] = t(`cron.jobHint.${job.key}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("cron.title")}</h2>
        <p className="muted mt-1 max-w-2xl text-sm">{t("cron.intro")}</p>
      </div>

      {!isRoot ? (
        <div className="alert alert-warning" role="status">
          <Icon name="alert" size={16} />
          <span>{t("cron.rootOnly")}</span>
        </div>
      ) : (
        <>
          {/* The state that matters most, in the words the overview uses. */}
          <div className={`alert ${health.stale || health.unfinished ? "alert-danger" : "alert-success"}`} role="status">
            <Icon name={health.stale || health.unfinished ? "alert" : "checkCircle"} size={16} />
            <span>
              {health.lastAt === null
                ? t("cron.never")
                : health.unfinished
                  ? t("cron.unfinished")
                  : health.stale
                    ? t("sync.stale", { n: health.ageMinutes ?? 0 })
                    : t("sync.ok", { n: health.ageMinutes ?? 0 })}
            </span>
          </div>

          <section className="card card-pad space-y-3">
            <div>
              <h3 className="font-semibold">{t("cron.setup")}</h3>
              <p className="muted mt-1 text-sm">{t("cron.setupHint")}</p>
            </div>

            <CopyField
              label={t("cron.url")}
              value={url}
              copyLabel={t("wallet.copy")}
              copiedLabel={t("wallet.copied")}
              mono
            />
            <CopyField
              label={t("cron.crontab")}
              value={`*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" ${url} >/dev/null`}
              copyLabel={t("wallet.copy")}
              copiedLabel={t("wallet.copied")}
              mono
            />

            {/* The secret stays an environment variable on purpose: it guards
                the endpoint that runs everything, and a value editable from
                the very screen it protects is a weaker secret. */}
            <p className={`text-sm ${configured ? "muted" : "text-[var(--danger)]"}`}>
              <Icon name={configured ? "check" : "alert"} size={14} />{" "}
              {configured ? t("cron.secretSet") : t("cron.secretMissing")}
            </p>
          </section>

          <CronManager rows={CRON_JOBS.map((j) => ({ key: j.key, moves: j.moves }))} labels={labels} />

          <section className="card overflow-hidden">
            <header className="border-b border-[var(--border)] px-5 py-4">
              <h3 className="font-semibold">{t("cron.recent")}</h3>
            </header>
            {recent.length === 0 ? (
              <p className="muted px-5 py-10 text-center text-sm">{t("cron.noRuns")}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recent.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className={`badge badge-${run.finishedAt ? "success" : "warning"}`}>
                      {run.finishedAt ? t("cron.finished") : t("cron.open")}
                    </span>
                    <span className="muted min-w-0 flex-1 truncate text-xs">
                      {run.trigger} · {run.dispatched} {t("cron.dispatched")} · {run.synced} {t("cron.synced")}
                      {run.failures ? ` · ${run.failures.split("\n").filter(Boolean).length} ${t("cron.failures")}` : ""}
                    </span>
                    <span className="muted text-xs">{dates.stamp(run.startedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
