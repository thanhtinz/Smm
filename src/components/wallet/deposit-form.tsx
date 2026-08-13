"use client";

import { useActionState, useMemo, useState } from "react";
import { createDepositAction, type DepositState } from "@/app/actions/wallet";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon, type IconName } from "@/components/icons";

export type MethodOption = {
  id: string;
  code: string;
  name: string;
  icon: string;
  description: string;
  currencies: string[];
  minAmount: number;
  maxAmount: number;
  feePercent: number;
  feeFixed: number;
  bonusPercent: number;
  configured: boolean;
};

export type CurrencyOption = { code: string; symbol: string; symbolBefore: boolean; decimals: number };

export type WalletLabels = Record<
  | "method"
  | "amount"
  | "currency"
  | "continue"
  | "fee"
  | "bonus"
  | "payable"
  | "credited"
  | "unavailable"
  | "presets"
  | "noMethods",
  string
>;

export default function DepositForm({
  methods,
  currencies,
  presets,
  labels,
  locale,
}: {
  methods: MethodOption[];
  currencies: CurrencyOption[];
  /** Quick-pick amounts, expressed in each method's own currency terms. */
  presets: Record<string, number[]>;
  labels: WalletLabels;
  locale: string;
}) {
  const [state, action] = useActionState<DepositState, FormData>(createDepositAction, {});
  const usable = methods.filter((m) => m.configured);

  const [methodId, setMethodId] = useState(usable[0]?.id ?? "");
  const method = usable.find((m) => m.id === methodId);

  const allowed = useMemo(() => {
    if (!method) return currencies;
    if (method.currencies.length === 0) return currencies;
    return currencies.filter((c) => method.currencies.includes(c.code));
  }, [method, currencies]);

  const [currency, setCurrency] = useState(allowed[0]?.code ?? "");
  const effectiveCurrency = allowed.some((c) => c.code === currency) ? currency : (allowed[0]?.code ?? "");
  const currencyInfo = allowed.find((c) => c.code === effectiveCurrency);

  const [amount, setAmount] = useState("");
  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;

  const fee = method && valid ? Math.max(0, (value * method.feePercent) / 100 + method.feeFixed) : 0;
  const bonus = method && valid ? Math.max(0, (value * method.bonusPercent) / 100) : 0;

  const fmt = (n: number) => {
    if (!currencyInfo) return String(n);
    const text = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale, {
      minimumFractionDigits: currencyInfo.decimals,
      maximumFractionDigits: currencyInfo.decimals,
    }).format(n);
    return currencyInfo.symbolBefore ? `${currencyInfo.symbol}${text}` : `${text}${currencyInfo.symbol}`;
  };

  if (usable.length === 0) {
    return (
      <div className="alert alert-info" role="status">
        <Icon name="info" size={16} />
        <span>{labels.noMethods}</span>
      </div>
    );
  }

  const quick = presets[effectiveCurrency] ?? [];

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2" noValidate>
      <div className="card card-pad min-w-0 space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <div>
          <span className="label">{labels.method}</span>
          <div className="grid gap-2">
            {methods.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                  m.id === methodId
                    ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                    : "border-[var(--border)] hover:bg-[var(--surface2)]"
                } ${m.configured ? "" : "opacity-55"}`}
              >
                <input
                  type="radio"
                  name="methodId"
                  value={m.id}
                  checked={m.id === methodId}
                  disabled={!m.configured}
                  onChange={() => setMethodId(m.id)}
                  className="sr-only"
                />
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    m.id === methodId ? "text-[var(--primary)]" : "muted"
                  }`}
                  style={{ background: "var(--surface2)" }}
                >
                  <Icon name={m.icon as IconName} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{m.name}</span>
                    {!m.configured && <span className="badge badge-warning">{labels.unavailable}</span>}
                    {m.bonusPercent > 0 && <span className="badge badge-success">+{m.bonusPercent}%</span>}
                  </span>
                  <span className="muted mt-0.5 block text-xs">{m.currencies.join(" · ")}</span>
                </span>
                {m.id === methodId && (
                  <span className="text-[var(--primary)]">
                    <Icon name="check" size={17} />
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <Field name="currency" label={labels.currency} error={state.fieldErrors?.currency}>
          <select
            id="currency"
            name="currency"
            className="field"
            value={effectiveCurrency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {allowed.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </Field>

        <Field
          name="amount"
          label={labels.amount}
          error={state.fieldErrors?.amount}
          hint={
            method && method.minAmount > 0
              ? `${method.minAmount.toLocaleString()} – ${method.maxAmount > 0 ? method.maxAmount.toLocaleString() : "∞"} ${effectiveCurrency}`
              : undefined
          }
          required
        >
          <TextInput
            name="amount"
            type="number"
            inputMode="decimal"
            step="any"
            min={method?.minAmount || undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(method?.minAmount || 0)}
            error={state.fieldErrors?.amount}
            hint={method && method.minAmount > 0 ? "range" : undefined}
          />
        </Field>

        {quick.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quick.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(String(n))}
                className="btn btn-ghost btn-sm tabular-nums"
              >
                {fmt(n)}
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="min-w-0">
        <div className="card card-pad lg:sticky lg:top-20">
          <dl className="space-y-2.5 text-sm">
            <Row label={labels.amount} value={valid ? fmt(value) : "—"} />
            {method && method.feePercent + method.feeFixed > 0 && <Row label={labels.fee} value={fmt(fee)} />}
            {bonus > 0 && <Row label={labels.bonus} value={`+${fmt(bonus)}`} />}
          </dl>

          <div className="divider my-4" />

          <div>
            <span className="muted text-xs tracking-wide uppercase">{labels.payable}</span>
            <p className="mt-0.5 text-2xl leading-tight font-bold tabular-nums">{valid ? fmt(value + fee) : "—"}</p>
          </div>

          {bonus > 0 && (
            <p className="muted mt-2 flex items-center justify-between text-xs">
              <span>{labels.credited}</span>
              <span className="tabular-nums">{fmt(value + bonus)}</span>
            </p>
          )}

          <SubmitButton className="btn btn-primary mt-4 w-full">
            <Icon name="arrowRight" size={16} />
            {labels.continue}
          </SubmitButton>
        </div>
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="muted min-w-0 text-[0.82rem]">{label}</dt>
      <dd className="shrink-0 text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
