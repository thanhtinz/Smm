"use client";

import { useState, useTransition } from "react";
import { runCronJobAction, type JobRun } from "@/app/actions/admin/cron";
import { runSyncNowAction } from "@/app/actions/admin/sync";
import { Icon } from "@/components/icons";

export type JobRow = { key: string; moves: string };

/**
 * The scheduled work, with a button beside each line.
 *
 * The result of a run is printed under the row that produced it rather than
 * in one banner at the top. An operator presses these because something is
 * wrong, usually more than once in a row, and a shared banner means the
 * answer to the last press overwrites the answer to the one before.
 */
export default function CronManager({ rows, labels }: { rows: JobRow[]; labels: Record<string, string> }) {
  const [results, setResults] = useState<Record<string, JobRun>>({});
  const [busy, setBusy] = useState("");
  const [pending, start] = useTransition();

  const run = (key: string, fn: () => Promise<JobRun>) => {
    setBusy(key);
    start(async () => {
      const result = await fn();
      setResults((r) => ({ ...r, [key]: result }));
      setBusy("");
    });
  };

  return (
    <div className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h3 className="font-semibold">{labels.jobs}</h3>
          <p className="muted mt-0.5 text-sm">{labels.jobsHint}</p>
        </div>
        <button
          type="button"
          onClick={() => run("__all", async () => runSyncNowAction())}
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          <Icon name={pending && busy === "__all" ? "spinner" : "refresh"} size={15} />
          {labels.runAll}
        </button>
      </header>

      {results.__all && <Result run={results.__all} labels={labels} className="border-b border-[var(--border)] px-5 py-3" />}

      <ul className="divide-y divide-[var(--border)]">
        {rows.map((row) => (
          <li key={row.key} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{labels[`job.${row.key}`] ?? row.key}</p>
                <p className="muted mt-0.5 text-sm">{labels[`jobHint.${row.key}`] ?? ""}</p>
              </div>
              {/* What pressing this can touch, so an operator diagnosing a
                  stuck queue knows which buttons are free and which spend. */}
              {row.moves !== "nothing" && (
                <span className={`badge badge-${row.moves === "money" ? "warning" : "info"}`}>
                  {labels[`moves.${row.moves}`]}
                </span>
              )}
              <button
                type="button"
                onClick={() => run(row.key, () => runCronJobAction(row.key))}
                disabled={pending}
                className="btn btn-ghost btn-sm"
              >
                <Icon name={pending && busy === row.key ? "spinner" : "send"} size={15} />
                {labels.run}
              </button>
            </div>
            {results[row.key] && <Result run={results[row.key]} labels={labels} className="mt-3" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Result({ run, labels, className = "" }: { run: JobRun; labels: Record<string, string>; className?: string }) {
  if (run.error) {
    return (
      <div className={className}>
        <p className="flex items-start gap-2 text-sm text-[var(--danger)]">
          <Icon name="alert" size={15} />
          {run.error}
        </p>
      </div>
    );
  }
  return (
    <div className={className}>
      <p className="flex items-start gap-2 text-sm text-[var(--success)]">
        <Icon name="check" size={15} />
        {run.summary || labels.done}
      </p>
      {run.failures && run.failures.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {run.failures.map((f, i) => (
            <li key={i} className="muted text-xs">
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
