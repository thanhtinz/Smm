"use client";

import { useActionState, useState, useTransition } from "react";
import {
  approvePanelRequestAction,
  rejectPanelRequestAction,
  refreshDelegationAction,
  type PanelRequestState,
} from "@/app/actions/panel-requests";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type QueuedRequest = {
  id: string;
  publicId: number;
  name: string;
  slug: string;
  host: string;
  status: string;
  note: string;
  owner: string;
  nameServers: string[];
  at: string;
};

/**
 * Requests waiting on the operator.
 *
 * Only the domain answers for itself here — the queue shows whether the
 * nameservers have moved, and approval is refused until they have. What the
 * operator is deciding is whether to take this reseller on, which is a
 * judgement; whether they own the domain is not, and is not asked.
 */
export default function PanelRequestQueue({
  rows,
  labels,
}: {
  rows: QueuedRequest[];
  labels: Record<string, string>;
}) {
  const [approving, setApproving] = useState<QueuedRequest | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pending, start] = useTransition();

  if (rows.length === 0) return null;

  const run = (id: string, fn: () => Promise<PanelRequestState>) => {
    setError("");
    setBusy(id);
    start(async () => {
      const result = await fn();
      setBusy("");
      if (result.error) setError(result.error);
    });
  };

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h3 className="font-semibold">{labels.queue}</h3>
        <p className="muted mt-1 text-sm">{labels.queueHint}</p>
      </div>

      {error && (
        <div className="alert alert-danger m-5" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <ul className="divide-y divide-[var(--border)]">
        {rows.map((row) => {
          const delegated = row.status === "delegated";
          return (
            <li key={row.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {row.name}
                    <span className="muted ml-2 font-mono text-xs">#{row.publicId}</span>
                  </p>
                  <p className="muted mt-1 text-sm">
                    {row.host} · {row.slug} · {row.owner}
                  </p>
                  <p className="muted mt-1 text-xs">{row.at}</p>
                </div>

                <span className={delegated ? "badge badge-success" : "badge badge-info"}>
                  <Icon name={delegated ? "checkCircle" : "clock"} size={11} />
                  {labels[`status_${row.status}`] ?? row.status}
                </span>
              </div>

              {/* Only worth showing while the reseller still has to act on
                  them, and then only so the operator can read out the pair
                  over chat when asked. */}
              {!delegated && row.nameServers.length > 0 && (
                <p className="muted font-mono text-xs break-all">{row.nameServers.join("  ·  ")}</p>
              )}

              {row.note && <p className="alert alert-warning text-xs">{row.note}</p>}

              <div className="flex flex-wrap gap-2">
                {!delegated && (
                  <button
                    type="button"
                    disabled={pending && busy === row.id}
                    onClick={() => run(row.id, () => refreshDelegationAction(row.id))}
                    className="btn btn-ghost btn-sm"
                  >
                    <Icon name="refresh" size={13} />
                    {labels.recheck}
                  </button>
                )}
                <button
                  type="button"
                  disabled={!delegated}
                  onClick={() => setApproving(row)}
                  className="btn btn-primary btn-sm"
                  title={delegated ? undefined : labels.needsDelegation}
                >
                  <Icon name="checkCircle" size={13} />
                  {labels.approve}
                </button>
                <button
                  type="button"
                  disabled={pending && busy === row.id}
                  onClick={() => {
                    const reason = prompt(labels.rejectReason) ?? "";
                    run(row.id, () => rejectPanelRequestAction(row.id, reason));
                  }}
                  className="btn btn-ghost btn-sm text-[var(--danger)]"
                >
                  <Icon name="close" size={13} />
                  {labels.reject}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {approving && <ApproveDrawer row={approving} labels={labels} onDone={() => setApproving(null)} />}
    </section>
  );
}

/**
 * The one thing approval still needs a human to type: who runs the new panel.
 *
 * The account belongs to the child, not the parent — a User belongs to
 * exactly one panel — so it cannot be inferred from the customer who asked.
 */
function ApproveDrawer({
  row,
  labels,
  onDone,
}: {
  row: QueuedRequest;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<PanelRequestState, FormData>(approvePanelRequestAction, {});
  if (state.ok) onDone();

  return (
    <EntityDrawer closeLabel={labels.close} open title={`${row.name} · ${row.host}`} onClose={onDone}>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <input type="hidden" name="requestId" value={row.id} />

        <Field name="adminUsername" label={labels.adminUsername} error={state.fieldErrors?.adminUsername} required>
          <TextInput name="adminUsername" autoComplete="off" error={state.fieldErrors?.adminUsername} required />
        </Field>

        <Field name="adminEmail" label={labels.adminEmail} error={state.fieldErrors?.adminEmail} required>
          <TextInput name="adminEmail" type="email" autoComplete="off" error={state.fieldErrors?.adminEmail} required />
        </Field>

        <Field name="adminPassword" label={labels.adminPassword} error={state.fieldErrors?.adminPassword} required>
          <TextInput
            name="adminPassword"
            type="password"
            autoComplete="new-password"
            error={state.fieldErrors?.adminPassword}
            required
          />
        </Field>

        <SubmitButton className="btn btn-primary w-full">{labels.approve}</SubmitButton>
      </form>
    </EntityDrawer>
  );
}
