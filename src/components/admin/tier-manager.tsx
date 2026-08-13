"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  deleteTierAction,
  saveTierAction,
  setTierPriceAction,
  type ActionResult,
} from "@/app/actions/admin/tiers";
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

export type TierServiceRow = {
  id: string;
  publicId: number;
  name: string;
  category: string;
  rate: number;
  /** Hand-set price for the selected tier, empty when the percentage applies. */
  manual: string;
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
  services,
  priceTierId,
  money,
  labels,
}: {
  rows: TierRow[];
  services: TierServiceRow[];
  priceTierId: string;
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

      {rows.length > 0 && (
        <PriceTable rows={rows} services={services} priceTierId={priceTierId} money={money} labels={labels} />
      )}

      {(creating || editing) && <TierDrawer row={editing} labels={labels} onClose={close} />}
    </>
  );
}

/**
 * Per-service prices for one tier. The percentage handles the whole catalogue;
 * this is for the services where it gives the wrong number.
 */
function PriceTable({
  rows,
  services,
  priceTierId,
  money,
  labels,
}: {
  rows: TierRow[];
  services: TierServiceRow[];
  priceTierId: string;
  money: MoneyFormat;
  labels: Record<string, string>;
}) {
  const fmt = formatter(money);
  const [query, setQuery] = useState("");
  const tier = rows.find((r) => r.id === priceTierId) ?? rows[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || String(s.publicId) === q,
    );
  }, [services, query]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] p-4 sm:px-5">
        <h3 className="font-semibold">{labels.prices}</h3>
        <form className="ml-auto flex flex-wrap items-center gap-2">
          <select
            name="tier"
            className="field w-auto"
            defaultValue={tier?.id}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set("tier", e.target.value);
              window.location.href = url.toString();
            }}
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <input
            className="field w-auto"
            placeholder={labels.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th className="w-20">ID</th>
              <th>{labels.service}</th>
              <th className="w-36 text-right">{labels.listRate}</th>
              <th className="w-36 text-right">{labels.afterDiscount}</th>
              <th className="w-52">{labels.manualPrice}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <PriceRow key={s.id} service={s} tier={tier} fmt={fmt} labels={labels} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceRow({
  service,
  tier,
  fmt,
  labels,
}: {
  service: TierServiceRow;
  tier: TierRow;
  fmt: (n: number) => string;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(setTierPriceAction, {});
  const discounted = service.rate * (1 - Math.min(100, tier.discountPercent) / 100);

  return (
    <tr>
      <td className="muted font-mono text-xs">{service.publicId}</td>
      <td>
        <span className="font-medium">{service.name}</span>
        <span className="muted block text-xs">{service.category}</span>
      </td>
      <td className="muted text-right tabular-nums">{fmt(service.rate)}</td>
      <td className={`text-right tabular-nums ${service.manual ? "muted line-through" : "font-semibold"}`}>
        {fmt(discounted)}
      </td>
      <td>
        <form action={action} className="flex items-center gap-1.5">
          <input type="hidden" name="tierId" value={tier.id} />
          <input type="hidden" name="serviceId" value={service.id} />
          <input
            name="rate"
            type="number"
            step="any"
            min="0"
            defaultValue={service.manual}
            placeholder={labels.usePercent}
            className={`field ${state.fieldErrors?.rate ? "field-error" : ""}`}
            aria-label={`${labels.manualPrice} — ${service.name}`}
          />
          <SubmitButton className="btn btn-ghost btn-sm">
            <Icon name="check" size={15} />
          </SubmitButton>
        </form>
      </td>
    </tr>
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
    <EntityDrawer open title={row ? labels.edit : labels.new} onClose={onClose}>
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
