"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addKeywordAction,
  removeKeywordAction,
  checkRanksNowAction,
  type ActionResult,
} from "@/app/actions/admin/keywords";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export type KeywordRow = {
  id: string;
  phrase: string;
  country: string;
  position: number;
  lastPosition: number;
  url: string;
  checkedAt: string;
  lastError: string;
};

/**
 * Position is shown as a number and a direction, because the number alone
 * answers the wrong question. Nobody asks "where am I" without also meaning
 * "and is that better than last week".
 *
 * Lower is better here, so the arrow and the colour are inverted against
 * every other figure in this panel — which is why the label says so rather
 * than leaving a green down-arrow to be read as a fall.
 */
function Move({ row, labels }: { row: KeywordRow; labels: Record<string, string> }) {
  if (row.position === 0 || row.lastPosition === 0 || row.position === row.lastPosition) return null;
  const better = row.position < row.lastPosition;
  const by = Math.abs(row.position - row.lastPosition);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${better ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
      title={better ? labels.up : labels.down}
    >
      <Icon name={better ? "arrowUp" : "arrowDown"} size={13} />
      {by}
    </span>
  );
}

export default function KeywordManager({ rows, labels }: { rows: KeywordRow[]; labels: Record<string, string> }) {
  const [state, action] = useActionState<ActionResult, FormData>(addKeywordAction, {});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state.ok]);

  const run = (fn: () => Promise<ActionResult>) => {
    setError("");
    start(async () => {
      const result = await fn();
      setError(result.error ?? "");
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
          <p className="muted mt-1 max-w-2xl text-sm">{labels.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => run(checkRanksNowAction)}
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          <Icon name="refresh" size={15} />
          {labels.checkNow}
        </button>
      </div>

      {(error || state.error) && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error || state.error}</span>
        </div>
      )}

      <form ref={form} action={action} className="card card-pad grid gap-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <Field name="phrase" label={labels.phrase} error={state.fieldErrors?.phrase} required>
          <TextInput name="phrase" placeholder={labels.phraseHint} error={state.fieldErrors?.phrase} />
        </Field>
        <Field name="country" label={labels.country} error={state.fieldErrors?.country}>
          <TextInput name="country" defaultValue="vn" error={state.fieldErrors?.country} />
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
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>{labels.phrase}</th>
                  <th className="w-20">{labels.country}</th>
                  <th className="w-32 text-end">{labels.position}</th>
                  <th className="w-40">{labels.checked}</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="block max-w-[22rem] truncate font-medium">{row.phrase}</span>
                      {row.url && (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="muted block max-w-[22rem] truncate text-xs hover:text-[var(--text)]"
                        >
                          {row.url}
                        </a>
                      )}
                      {row.lastError && <span className="mt-0.5 block text-xs text-[var(--danger)]">{row.lastError}</span>}
                    </td>
                    <td className="muted text-xs uppercase">{row.country}</td>
                    <td className="text-end">
                      {row.position > 0 ? (
                        // The position leads, because it is the answer; the
                        // move follows it the way a delta follows a figure.
                        <span className="flex items-baseline justify-end gap-2">
                          <span className="font-mono text-base font-bold tabular-nums">{row.position}</span>
                          <Move row={row} labels={labels} />
                        </span>
                      ) : (
                        // Not the same as a bad position, and saying "0" would
                        // read as one.
                        <span className="muted text-xs">{row.checkedAt ? labels.notFound : labels.notChecked}</span>
                      )}
                    </td>
                    <td className="muted text-xs">{row.checkedAt || "—"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => run(() => removeKeywordAction(row.id))}
                        disabled={pending}
                        className="btn btn-ghost btn-sm"
                        aria-label={`${labels.delete} ${row.phrase}`}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
