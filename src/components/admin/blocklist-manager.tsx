"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addBlockAction, removeBlockAction, type ActionResult } from "@/app/actions/admin/blocklist";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export type BlockRow = {
  id: string;
  kind: string;
  value: string;
  note: string;
  createdAt: string;
};

/**
 * The list, with the form always open above it.
 *
 * Not a drawer like the other managers: this is the one admin screen someone
 * opens in a hurry, halfway through a fraud, to type one line and get back to
 * it. A row here has nothing to edit — a wrong entry is deleted and retyped —
 * so there is no second state to design for.
 */
export default function BlocklistManager({ rows, labels }: { rows: BlockRow[]; labels: Record<string, string> }) {
  const [state, action] = useActionState<ActionResult, FormData>(addBlockAction, {});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state.ok]);

  const remove = (row: BlockRow) => {
    if (!confirm(labels.confirmDelete)) return;
    setError("");
    start(async () => {
      const result = await removeBlockAction(row.id);
      if (result.error) setError(result.error);
    });
  };

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        <p className="muted mt-1 max-w-2xl text-sm">{labels.intro}</p>
      </div>

      {(error || state.error) && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error || state.error}</span>
        </div>
      )}

      <form ref={form} action={action} className="card card-pad grid gap-4 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end">
        <Field name="kind" label={labels.kind}>
          <select name="kind" defaultValue="link" className="field">
            <option value="link">{labels["kind.link"]}</option>
            <option value="username">{labels["kind.username"]}</option>
          </select>
        </Field>
        <Field name="value" label={labels.value} error={state.fieldErrors?.value} required>
          <TextInput name="value" placeholder={labels.valueHint} error={state.fieldErrors?.value} />
        </Field>
        <Field name="note" label={labels.note}>
          <TextInput name="note" />
        </Field>
        <SubmitButton className="btn btn-primary">
          <Icon name="plus" size={15} />
          {labels.add}
        </SubmitButton>
      </form>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="muted px-5 py-14 text-center text-sm">{labels.empty}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
                <span className="badge badge-info shrink-0">{labels[`kind.${row.kind}`] ?? row.kind}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm break-all">{row.value}</p>
                  {row.note && <p className="muted mt-0.5 text-xs">{row.note}</p>}
                </div>
                <span className="muted text-xs">{row.createdAt}</span>
                <button
                  type="button"
                  onClick={() => remove(row)}
                  disabled={pending}
                  className="btn btn-ghost btn-sm"
                  aria-label={`${labels.delete} ${row.value}`}
                >
                  <Icon name="trash" size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
