"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteTierAction, saveTierAction, type ActionResult } from "@/app/actions/admin/tiers";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type TierRow = {
  id: string;
  name: string;
  slug: string;
  discountPercent: number;
  minSpent: number;
  color: string;
  isDefault: boolean;
  position: number;
  members: number;
  manualPrices: number;
};

/** Enough to format base-currency amounts without shipping a function prop. */
export type MoneyFormat = {
  symbol: string;
  symbolBefore: boolean;
  decimals: number;
  rate: number;
  locale: string;
};

function formatter(money: MoneyFormat) {
  return (amountInBase: number) => {
    const value = amountInBase * money.rate;
    const text = new Intl.NumberFormat(money.locale === "vi" ? "vi-VN" : money.locale, {
      minimumFractionDigits: money.decimals,
      maximumFractionDigits: money.decimals,
    }).format(value);
    return money.symbolBefore ? `${money.symbol}${text}` : `${text}${money.symbol}`;
  };
}

export default function TierManager({
  rows,
  money,
  labels,
}: {
  rows: TierRow[];
  money: MoneyFormat;
  labels: Record<string, string>;
}) {
  const fmt = formatter(money);
  const [editing, setEditing] = useState<TierRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        <button type="button" onClick={() => setCreating(true)} className="btn btn-primary btn-sm">
          <Icon name="plus" size={15} />
          {labels.new}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="muted px-5 py-14 text-center text-sm">{labels.empty}</p>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>{labels.tier}</th>
                  <th className="w-28 text-right">{labels.discount}</th>
                  <th className="w-36 text-right">{labels.minSpent}</th>
                  <th className="w-24 text-right">{labels.members}</th>
                  <th className="w-28 text-right">{labels.manual}</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: row.color }}
                        />
                        <span className="font-medium">{row.name}</span>
                        {row.isDefault && <span className="badge badge-info">{labels.starting}</span>}
                      </span>
                      <span className="muted block font-mono text-xs">{row.slug}</span>
                    </td>
                    <td className="text-right tabular-nums">
                      {row.discountPercent > 0 ? `-${row.discountPercent}%` : "—"}
                    </td>
                    <td className="text-right tabular-nums">{row.minSpent > 0 ? fmt(row.minSpent) : "—"}</td>
                    <td className="text-right tabular-nums">{row.members}</td>
                    <td className="text-right tabular-nums">{row.manualPrices || "—"}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          className="btn btn-ghost btn-sm"
                          title={labels.edit}
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(labels.confirmDelete)) return;
                            setError("");
                            start(async () => {
                              const result = await deleteTierAction(row.id);
                              if (result.error) setError(result.error);
                            });
                          }}
                          className="btn btn-ghost btn-sm"
                          title={labels.delete}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && <TierDrawer row={editing} labels={labels} onClose={close} />}
    </>
  );
}

function TierDrawer({
  row,
  labels,
  onClose,
}: {
  row: TierRow | null;
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(saveTierAction, {});

  return (
    <EntityDrawer closeLabel={labels.close} open title={row ? labels.edit : labels.new} onClose={onClose}>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <input type="hidden" name="id" value={row?.id ?? ""} />

        <Field name="name" label={labels.name} error={state.fieldErrors?.name} required>
          <TextInput name="name" defaultValue={row?.name ?? ""} error={state.fieldErrors?.name} />
        </Field>
        <Field name="slug" label={labels.slug} error={state.fieldErrors?.slug}>
          <TextInput name="slug" defaultValue={row?.slug ?? ""} error={state.fieldErrors?.slug} />
        </Field>
        <Field name="discountPercent" label={labels.discount} error={state.fieldErrors?.discountPercent}>
          <TextInput
            name="discountPercent"
            type="number"
            step="any"
            min="0"
            max="99"
            defaultValue={String(row?.discountPercent ?? 0)}
            error={state.fieldErrors?.discountPercent}
          />
        </Field>
        <Field name="minSpent" label={labels.minSpent} error={state.fieldErrors?.minSpent} hint={labels.minSpentHint}>
          <TextInput
            name="minSpent"
            type="number"
            step="any"
            min="0"
            defaultValue={String(row?.minSpent ?? 0)}
            hint={labels.minSpentHint}
          />
        </Field>
        <Field name="color" label={labels.color}>
          <input
            id="color"
            name="color"
            type="color"
            defaultValue={row?.color ?? "#6366f1"}
            className="field h-11 w-24 p-1"
          />
        </Field>
        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={row?.isDefault ?? false}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          {labels.starting}
        </label>

        <SubmitButton className="btn btn-primary w-full">
          <Icon name="check" size={16} />
          {labels.save}
        </SubmitButton>
      </form>
    </EntityDrawer>
  );
}
