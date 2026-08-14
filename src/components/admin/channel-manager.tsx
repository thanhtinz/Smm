"use client";

import { useActionState, useState, useTransition } from "react";
import {
  connectChannelAction,
  deleteChannelAction,
  setChannelEnabledAction,
  type ActionResult,
} from "@/app/actions/admin/inbox";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";
import { CopyButton } from "@/components/tools/shell";

export type ChannelRow = {
  id: string;
  kind: string;
  name: string;
  externalId: string;
  enabled: boolean;
  threads: number;
  webhook: string;
};

export default function ChannelManager({
  rows,
  kinds,
  planned,
  labels,
}: {
  rows: ChannelRow[];
  /** Kinds with a working driver, and the fields each needs. */
  kinds: { kind: string; label: string; fields: { key: string; secret?: boolean }[] }[];
  /** Named but not connectable yet; listed so the gap is stated, not hidden. */
  planned: string[];
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(connectChannelAction, {});
  const [kind, setKind] = useState(kinds[0]?.kind ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const active = kinds.find((k) => k.kind === kind);

  const run = (fn: () => Promise<ActionResult>) => {
    setError("");
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="space-y-6">
      {(error || state.error) && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error || state.error}</span>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="font-semibold">{labels.connected}</h3>
        <div className="card overflow-hidden">
          {rows.length === 0 ? (
            <p className="muted px-5 py-12 text-center text-sm">{labels.none}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <li key={row.id} className="space-y-3 p-4 sm:px-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {row.name}
                        <span className="muted font-normal"> · {row.kind}</span>
                      </p>
                      <p className="muted mt-0.5 font-mono text-xs">
                        {row.externalId} · {labels.threads}: {row.threads}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          disabled={pending}
                          onChange={(e) => run(() => setChannelEnabledAction(row.id, e.target.checked))}
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        {row.enabled ? labels.on : labels.off}
                      </label>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(labels.confirmDelete)) run(() => deleteChannelAction(row.id));
                        }}
                        className="btn btn-danger btn-sm"
                        aria-label={`${labels.delete} ${row.name}`}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>

                  {/* The address the platform has to be pointed at. Useless
                      unless it can be copied, so it is copyable. */}
                  <div className="surface-2 flex items-center gap-2 rounded-lg px-3 py-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-xs">{row.webhook}</code>
                    <CopyButton value={row.webhook} labels={labels} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">{labels.connect}</h3>

        <form action={action} className="card card-pad space-y-4">
          <Field name="kind" label={labels.platform}>
            <select id="kind" name="kind" className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>

          {active?.fields.map((f) => (
            <Field key={f.key} name={f.key} label={labels[`field.${f.key}`] ?? f.key}>
              <TextInput name={f.key} type={f.secret ? "password" : "text"} autoComplete="off" />
            </Field>
          ))}

          <Field name="name" label={labels.label} hint={labels.labelHint}>
            <TextInput name="name" />
          </Field>

          {/* Optional, and it earns its place here: Telegram is throttled or
              blocked on some networks in this market, so an operator running
              their own proxy needs somewhere to say so. */}
          <Field name="apiBase" label={labels.apiBase} hint={labels.apiBaseHint}>
            <TextInput name="apiBase" autoComplete="off" />
          </Field>

          <SubmitButton className="btn btn-primary w-full">{labels.connect}</SubmitButton>
        </form>

        {planned.length > 0 && (
          <p className="muted text-sm leading-relaxed">
            {labels.planned}: {planned.join(", ")}. {labels.plannedWhy}
          </p>
        )}
      </section>
    </div>
  );
}
