"use client";

import { useState, useTransition } from "react";
import {
  deleteRouteAction,
  saveRouteAction,
  setRouteEnabledAction,
  type ActionResult,
} from "@/app/actions/admin/routes";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/icons";

export type RouteRow = {
  id: string;
  providerId: string;
  providerName: string;
  providerServiceId: string;
  cost: number;
  enabled: boolean;
  /** Why this one would be skipped right now, if it would. */
  skipped: "" | "disabled" | "empty";
  /** The one the service names as its first choice, edited above. */
  primary: boolean;
  costLabel: string;
};

/**
 * The suppliers a service can be filled by, in the order dispatch will try
 * them. Shown inside the service drawer because "who supplies this" is a
 * property of the service, not a screen of its own.
 */
export default function RouteEditor({
  serviceId,
  rows,
  providers,
  labels,
}: {
  serviceId: string;
  rows: RouteRow[];
  providers: { id: string; name: string }[];
  labels: Record<string, string>;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) => {
    setError("");
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  };

  return (
    <fieldset className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <legend className="px-1.5 text-sm font-semibold">{labels.title}</legend>
      <p className="muted text-xs">{labels.hint}</p>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="muted py-3 text-center text-sm">{labels.empty}</p>
      ) : (
        <ol className="divide-y divide-[var(--border)]">
          {rows.map((row, index) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="muted w-5 shrink-0 text-center text-xs tabular-nums">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {row.providerName}
                  {row.primary && <span className="badge badge-muted">{labels.primary}</span>}
                  {row.skipped === "disabled" && <span className="badge badge-danger">{labels.providerOff}</span>}
                  {row.skipped === "empty" && <span className="badge badge-warning">{labels.balanceOut}</span>}
                </p>
                <p className="muted font-mono text-xs">
                  #{row.providerServiceId} · {row.costLabel}
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={pending}
                  onChange={(e) => run(() => setRouteEnabledAction(row.id, e.target.checked))}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                {labels.enabled}
              </label>
              {/* The first choice is edited in the fields above, so removing it
                  here would only put it back on the next save. */}
              {!row.primary && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(labels.confirmDelete)) run(() => deleteRouteAction(row.id));
                  }}
                  className="btn btn-danger btn-sm"
                  aria-label={`${labels.delete} ${row.providerName}`}
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {adding ? (
        <AddRoute
          serviceId={serviceId}
          providers={providers.filter((p) => !rows.some((r) => r.providerId === p.id))}
          labels={labels}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn btn-ghost btn-sm">
          <Icon name="plus" size={15} />
          {labels.add}
        </button>
      )}
    </fieldset>
  );
}

function AddRoute({
  serviceId,
  providers,
  labels,
  onDone,
}: {
  serviceId: string;
  providers: { id: string; name: string }[];
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, setState] = useState<ActionResult>({});
  const [pending, start] = useTransition();
  const [providerId, setProviderId] = useState("");
  const [providerServiceId, setProviderServiceId] = useState("");
  const [cost, setCost] = useState("0");
  const [enabled, setEnabled] = useState(true);

  // Built by hand rather than posted from a <form>: the service drawer this
  // sits inside is already one, and a form inside a form is neither valid
  // HTML nor something React will submit.
  const submit = () =>
    start(async () => {
      const data = new FormData();
      data.set("serviceId", serviceId);
      data.set("providerId", providerId);
      data.set("providerServiceId", providerServiceId);
      data.set("cost", cost);
      if (enabled) data.set("enabled", "on");
      const result = await saveRouteAction({}, data);
      setState(result);
      if (result.ok) onDone();
    });

  return (
    <div className="surface-2 space-y-3 rounded-lg p-3">
      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <Field name="routeProviderId" label={labels.provider} error={state.fieldErrors?.providerId}>
        <select
          id="routeProviderId"
          className="field"
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
        >
          <option value="">{labels.provider}</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="routeServiceId" label={labels.serviceId} error={state.fieldErrors?.providerServiceId}>
          <TextInput
            name="routeServiceId"
            value={providerServiceId}
            onChange={(e) => setProviderServiceId(e.target.value)}
            error={state.fieldErrors?.providerServiceId}
            placeholder="1234"
          />
        </Field>
        <Field name="routeCost" label={labels.cost} error={state.fieldErrors?.cost}>
          <TextInput
            name="routeCost"
            type="number"
            step="0.0001"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            error={state.fieldErrors?.cost}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        {labels.enabled}
      </label>

      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className="btn btn-primary btn-sm flex-1">
          <Icon name="check" size={15} />
          {labels.save}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">
          {labels.cancel}
        </button>
      </div>
    </div>
  );
}
