"use client";

import { useTransition, useState } from "react";
import { runSyncNowAction } from "@/app/actions/admin/sync";
import { Icon } from "@/components/icons";

export type SyncView = {
  tone: "ok" | "warn";
  headline: string;
  detail: string;
  failures: string[];
  canRun: boolean;
};

/**
 * The one thing on the overview that is allowed to be red.
 *
 * Revenue and order counts look healthy right up until somebody notices the
 * orders were never sent, so this sits above them and states plainly whether
 * the scheduler is still calling.
 */
export default function SyncStatus({ view, labels }: { view: SyncView; labels: Record<string, string> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const warn = view.tone === "warn";

  return (
    <section
      className="rounded-[var(--radius)] border p-5"
      style={
        warn
          ? {
              borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)",
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
            }
          : { borderColor: "var(--border)", background: "var(--surface)" }
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={warn ? "text-[var(--danger)]" : "text-[var(--success)]"}>
          <Icon name={warn ? "alert" : "checkCircle"} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{view.headline}</p>
          <p className="muted mt-0.5 text-sm">{view.detail}</p>
        </div>

        {view.canRun && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError("");
                const result = await runSyncNowAction();
                if (result.error) setError(result.error);
              })
            }
            className="btn btn-ghost btn-sm"
          >
            <Icon name={pending ? "spinner" : "refresh"} size={15} />
            {pending ? labels.running : labels.runNow}
          </button>
        )}
      </div>

      {view.failures.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <p className="muted text-xs font-semibold tracking-wide uppercase">{labels.failures}</p>
          <ul className="muted mt-1.5 space-y-1 text-sm">
            {/* Keyed by position, not by text: the same job failing the same
                way twice is the normal case here, and two identical strings
                as keys is React quietly dropping one of them. */}
            {view.failures.slice(0, 5).map((f, i) => (
              <li key={i} className="font-mono text-xs">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--danger)]" role="alert">
          <Icon name="alert" size={15} />
          {error}
        </p>
      )}
    </section>
  );
}
