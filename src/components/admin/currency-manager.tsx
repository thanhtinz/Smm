"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteCurrencyAction,
  saveCurrencyAction,
  refreshRatesAction,
  setBaseCurrencyAction,
  setCurrencyAutoAction,
  type ActionResult,
} from "@/app/actions/admin/config";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type CurrencyRow = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  symbolBefore: boolean;
  decimals: number;
  numberFormat: string;
  rate: number;
  enabled: boolean;
  isBase: boolean;
  position: number;
  autoUpdate: boolean;
  /** Pre-formatted; empty when this rate has never been fetched. */
  rateUpdatedAt: string;
};

export default function CurrencyManager({
  rows,
  autoUpdate,
  labels,
}: {
  rows: CurrencyRow[];
  /** Whether the scheduled updater is switched on, set in Settings. */
  autoUpdate: boolean;
  labels: Record<string, string>;
}) {
  const [editing, setEditing] = useState<CurrencyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const run = (fn: () => Promise<ActionResult>) => {
    setError("");
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => run(() => refreshRatesAction())}
            disabled={pending}
            className="btn btn-ghost btn-sm"
          >
            <Icon name="refresh" size={15} />
            {labels.refreshRates}
          </button>
          <button type="button" onClick={() => setCreating(true)} className="btn btn-primary btn-sm">
            <Icon name="plus" size={15} />
            {labels.new}
          </button>
        </div>
      </div>

      {!autoUpdate && (
        <div className="alert alert-info" role="status">
          <Icon name="info" size={16} />
          <span>{labels.autoOff}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th className="w-24">{labels.code}</th>
                <th>{labels.name}</th>
                <th className="w-20 text-center">{labels.symbol}</th>
                <th className="w-40 text-end">{labels.rate}</th>
                <th className="w-32">{labels.autoRate}</th>
                <th className="w-28">{labels.status}</th>
                <th className="w-40 text-end">{labels.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono font-semibold">{row.code}</td>
                  <td className="muted">{row.name}</td>
                  <td className="text-center">{row.symbol}</td>
                  <td className="text-end tabular-nums">
                    {row.isBase ? <span className="badge badge-info">{labels.base}</span> : row.rate.toPrecision(6)}
                  </td>
                  <td>
                    {row.isBase ? (
                      <span className="muted text-xs">—</span>
                    ) : (
                      <>
                        <label className="flex cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={row.autoUpdate}
                            disabled={pending}
                            onChange={(e) => run(() => setCurrencyAutoAction(row.id, e.target.checked))}
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          {row.autoUpdate ? labels.autoOn : labels.autoPinned}
                        </label>
                        {row.autoUpdate && row.rateUpdatedAt && (
                          <span className="muted mt-0.5 block text-[0.7rem]">{row.rateUpdatedAt}</span>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${row.enabled ? "badge-success" : "badge-muted"}`}>
                      <Icon name={row.enabled ? "check" : "close"} size={11} />
                      {row.enabled ? labels.enabled : labels.disabled}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {!row.isBase && (
                        <button
                          type="button"
                          onClick={() => run(() => setBaseCurrencyAction(row.id))}
                          disabled={pending}
                          className="btn btn-ghost btn-sm"
                          title={labels.setBase}
                        >
                          <Icon name="star" size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        className="btn btn-ghost btn-sm"
                        aria-label={`${labels.edit} ${row.code}`}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(labels.confirmDelete)) run(() => deleteCurrencyAction(row.id));
                        }}
                        disabled={pending || row.isBase}
                        className="btn btn-danger btn-sm"
                        aria-label={`${labels.delete} ${row.code}`}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EntityDrawer
        closeLabel={labels.close}
        open={creating || editing !== null}
        title={editing ? `${labels.edit} — ${editing.code}` : labels.new}
        onClose={close}
      >
        <CurrencyForm key={editing?.id ?? "new"} row={editing} labels={labels} onDone={close} />
      </EntityDrawer>
    </>
  );
}

function CurrencyForm({
  row,
  labels,
  onDone,
}: {
  row: CurrencyRow | null;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveCurrencyAction(prev, form);
    if (result.ok) onDone();
    return result;
  }, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {row && <input type="hidden" name="id" value={row.id} />}

      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="code" label={labels.code} error={state.fieldErrors?.code} required>
          <TextInput name="code" defaultValue={row?.code} error={state.fieldErrors?.code} placeholder="USD" maxLength={3} />
        </Field>
        <Field name="symbol" label={labels.symbol}>
          <TextInput name="symbol" defaultValue={row?.symbol} placeholder="$" />
        </Field>
      </div>

      <Field name="name" label={labels.name}>
        <TextInput name="name" defaultValue={row?.name} placeholder={labels.egName} />
      </Field>

      <Field name="rate" label={labels.rate} error={state.fieldErrors?.rate} hint={labels.rateHint} required>
        <TextInput
          name="rate"
          type="number"
          step="any"
          defaultValue={String(row?.rate ?? 1)}
          error={state.fieldErrors?.rate}
          hint={labels.rateHint}
          disabled={row?.isBase}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="decimals" label={labels.decimals}>
          <TextInput name="decimals" type="number" min={0} max={8} defaultValue={String(row?.decimals ?? 2)} />
        </Field>
        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
        </Field>
      </div>

      {/* Named by its own sample rather than by "dot-comma": nobody picks a
          punctuation scheme from a slug, and the sample is the thing being
          chosen. It belongs to the currency and not to the reader — the dong
          is written 2.500₫ to everybody. */}
      <Field name="numberFormat" label={labels.numberFormat} hint={labels.numberFormatHint}>
        <select
          id="numberFormat"
          name="numberFormat"
          className="field"
          defaultValue={row?.numberFormat ?? "comma-dot"}
        >
          <option value="comma-dot">1,234,567.89</option>
          <option value="dot-comma">1.234.567,89</option>
          <option value="space-comma">1&#8239;234&#8239;567,89</option>
          <option value="indian">12,34,567.89</option>
          <option value="plain">1234567.89</option>
        </select>
      </Field>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="symbolBefore"
          defaultChecked={row?.symbolBefore ?? true}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        {labels.symbolBefore}
      </label>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={row?.enabled ?? true} className="h-4 w-4 accent-[var(--primary)]" />
        {labels.enabled}
      </label>

      <div className="flex gap-2 pt-2">
        <SubmitButton className="btn btn-primary flex-1">
          <Icon name="check" size={16} />
          {labels.save}
        </SubmitButton>
        <button type="button" onClick={onDone} className="btn btn-ghost">
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
