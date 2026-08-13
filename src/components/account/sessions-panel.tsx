"use client";

import { useState, useTransition } from "react";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/app/actions/sessions";
import { Icon } from "@/components/icons";

export type SessionRow = {
  id: string;
  device: string;
  ip: string;
  signedIn: string;
  expires: string;
  /** The one reading this page. */
  current: boolean;
};

/**
 * Where the account is signed in, and a way to end any of it. This is what
 * "signs you out everywhere else" actually means, made visible — and the
 * first place to look after a password has been somewhere it should not.
 */
export default function SessionsPanel({
  rows,
  labels,
}: {
  rows: SessionRow[];
  labels: Record<
    | "title"
    | "hint"
    | "device"
    | "ip"
    | "signedIn"
    | "expires"
    | "current"
    | "revoke"
    | "revokeOthers"
    | "confirmOthers"
    | "closed"
    | "none"
    | "unknownIp",
    string
  >;
}) {
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(0);
  const [pending, start] = useTransition();

  const others = rows.filter((r) => !r.current).length;

  const run = (fn: () => Promise<{ error?: string; closed?: number }>) =>
    start(async () => {
      setError("");
      const result = await fn();
      if (result.error) setError(result.error);
      else setClosed(result.closed ?? 0);
    });

  return (
    <section className="card card-pad space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{labels.title}</h3>
        {others > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(labels.confirmOthers)) run(revokeOtherSessionsAction);
            }}
            className="btn btn-ghost btn-sm"
          >
            <Icon name="logout" size={15} />
            {labels.revokeOthers}
          </button>
        )}
      </div>

      <p className="muted text-sm">{labels.hint}</p>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {closed > 0 && (
        <div className="alert alert-success" role="status">
          <Icon name="checkCircle" size={16} />
          <span>{labels.closed.replace("{count}", String(closed))}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="muted text-sm">{labels.none}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {row.device}
                  {row.current && <span className="badge badge-success">{labels.current}</span>}
                </p>
                <p className="muted mt-0.5 text-xs">
                  {row.ip || labels.unknownIp} · {labels.signedIn} {row.signedIn} · {labels.expires} {row.expires}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => revokeSessionAction(row.id))}
                className="btn btn-ghost btn-sm"
                title={labels.revoke}
              >
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
