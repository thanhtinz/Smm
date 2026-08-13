"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { placeOrderAction, type OrderState } from "@/app/actions/orders";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon, type IconName } from "@/components/icons";

export type ServiceOption = {
  id: string;
  publicId: number;
  name: string;
  categoryId: string;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  averageTime: string;
  description: string;
};

export type CategoryOption = { id: string; name: string; platformId: string | null };
export type PlatformOption = { id: string; name: string; icon: string; color: string };

export default function NewOrderForm({
  platforms,
  categories,
  services,
  balance,
  currency,
  labels,
}: {
  platforms: PlatformOption[];
  categories: CategoryOption[];
  services: ServiceOption[];
  balance: number;
  /** Conversion + formatting for the viewer's display currency. */
  currency: { code: string; symbol: string; symbolBefore: boolean; decimals: number; rate: number; locale: string };
  labels: Record<
    | "platform"
    | "category"
    | "service"
    | "link"
    | "quantity"
    | "charge"
    | "submit"
    | "min"
    | "max"
    | "rate"
    | "balance"
    | "addFunds"
    | "choose"
    | "selectCategory"
    | "selectService"
    | "selectPlatformFirst"
    | "selectCategoryFirst"
    | "averageTime"
    | "refillLabel"
    | "yes"
    | "no"
    | "placed"
    | "track"
    | "insufficient",
    string
  >;
}) {
  const [state, action] = useActionState<OrderState, FormData>(placeOrderAction, {});

  // Strictly cascading: nothing is preselected, and each step only unlocks
  // once the step above it has been answered.
  const [platformId, setPlatformId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");

  const visibleCategories = useMemo(
    () => (platformId ? categories.filter((c) => c.platformId === platformId) : []),
    [categories, platformId]
  );
  const visibleServices = useMemo(
    () => (categoryId ? services.filter((s) => s.categoryId === categoryId) : []),
    [services, categoryId]
  );
  const service = visibleServices.find((s) => s.id === serviceId);

  const [quantity, setQuantity] = useState("");
  const qty = Number(quantity);
  const charge = service && Number.isFinite(qty) && qty > 0 ? Math.round((service.rate * qty) / 1000) : 0;
  const affordable = charge <= balance;

  const fmt = (base: number) => {
    const value = new Intl.NumberFormat(currency.locale === "vi" ? "vi-VN" : currency.locale, {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    }).format(base * currency.rate);
    return currency.symbolBefore ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  };

  const outOfRange = service && qty > 0 && (qty < service.min || qty > service.max);

  if (state.success) {
    return (
      <div className="card card-pad text-center">
        <span className="inline-flex text-[var(--success)]">
          <Icon name="checkCircle" size={40} />
        </span>
        <h2 className="mt-4 text-xl font-bold">{labels.placed.replace("{id}", String(state.success.orderId))}</h2>
        <p className="muted mt-2 text-sm">
          {labels.charge}: <strong className="text-[var(--text)]">{fmt(state.success.charge)}</strong>
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/dashboard/orders" className="btn btn-primary btn-sm">
            <Icon name="list" size={15} />
            {labels.track}
          </Link>
          <a href="/dashboard/new-order" className="btn btn-ghost btn-sm">
            <Icon name="plus" size={15} />
            {labels.submit}
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[1.45fr_1fr]" noValidate>
      <div className="card card-pad space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        {/* Platform is a chip row rather than a select — it is the widest
            branch of the choice and benefits from being visible at a glance. */}
        <div>
          <span className="label">{labels.platform}</span>
          <div className="scroll-x -mx-1 px-1">
            <div className="flex gap-2 pb-1">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlatformId(p.id);
                    setCategoryId("");
                    setServiceId("");
                  }}
                  aria-pressed={p.id === platformId}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                    p.id === platformId
                      ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
                      : "muted border-[var(--border)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                  }`}
                >
                  <span style={p.id === platformId ? undefined : { color: p.color }}>
                    <Icon name={p.icon as IconName} size={16} />
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Field name="categoryId" label={labels.category}>
          <select
            id="categoryId"
            name="categoryId"
            className="field"
            value={categoryId}
            disabled={!platformId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setServiceId("");
            }}
          >
            <option value="">{platformId ? labels.selectCategory : labels.selectPlatformFirst}</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field name="serviceId" label={labels.service} error={state.fieldErrors?.serviceId}>
          <select
            id="serviceId"
            name="serviceId"
            className="field"
            value={serviceId}
            disabled={!categoryId}
            onChange={(e) => setServiceId(e.target.value)}
            aria-invalid={state.fieldErrors?.serviceId ? true : undefined}
          >
            <option value="">{categoryId ? labels.selectService : labels.selectCategoryFirst}</option>
            {visibleServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.publicId} — {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field name="link" label={labels.link} error={state.fieldErrors?.link} required>
          <TextInput
            name="link"
            type="url"
            inputMode="url"
            placeholder="https://instagram.com/yourprofile"
            error={state.fieldErrors?.link}
          />
        </Field>

        <Field
          name="quantity"
          label={labels.quantity}
          error={state.fieldErrors?.quantity ?? (outOfRange ? rangeMessage(service, labels) : undefined)}
          hint={service ? `${labels.min} ${service.min.toLocaleString()} · ${labels.max} ${service.max.toLocaleString()}` : undefined}
          required
        >
          <TextInput
            name="quantity"
            type="number"
            inputMode="numeric"
            min={service?.min}
            max={service?.max}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={String(service?.min ?? 100)}
            error={state.fieldErrors?.quantity ?? (outOfRange ? "range" : undefined)}
            hint={service ? "range" : undefined}
          />
        </Field>
      </div>

      {/* ------------------------------------------------------ summary */}
      <aside className="space-y-4">
        <div className="card card-pad lg:sticky lg:top-20">
          <h2 className="font-semibold">{labels.charge}</h2>

          {service ? (
            <>
              <p className="muted mt-3 text-sm leading-relaxed">{service.name}</p>

              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label={labels.rate} value={fmt(service.rate)} />
                <Row label={labels.quantity} value={qty > 0 ? qty.toLocaleString() : "—"} />
                {service.averageTime && <Row label={labels.averageTime} value={service.averageTime} />}
                <Row
                  label={labels.refillLabel}
                  value={
                    service.refill ? (
                      <span className="badge badge-success">
                        <Icon name="refresh" size={12} />
                        {labels.yes}
                      </span>
                    ) : (
                      <span className="badge badge-muted">{labels.no}</span>
                    )
                  }
                />
              </dl>

              <div className="divider my-4" />

              <div>
                <span className="muted text-xs tracking-wide uppercase">{labels.charge}</span>
                <p className="mt-0.5 text-2xl leading-tight font-bold tabular-nums">{fmt(charge)}</p>
              </div>

              <p className="muted mt-2 flex items-center justify-between text-xs">
                <span>{labels.balance}</span>
                <span className="tabular-nums">{fmt(balance)}</span>
              </p>

              {!affordable && charge > 0 && (
                <div className="alert alert-danger mt-4" role="alert">
                  <Icon name="alert" size={15} />
                  <span>{labels.insufficient}</span>
                </div>
              )}

              <SubmitButton className="btn btn-primary mt-4 w-full">
                <Icon name="cart" size={16} />
                {labels.submit}
              </SubmitButton>

              {!affordable && charge > 0 && (
                <Link href="/dashboard/wallet" className="btn btn-ghost btn-sm mt-2 w-full">
                  <Icon name="wallet" size={15} />
                  {labels.addFunds}
                </Link>
              )}
            </>
          ) : (
            <p className="muted mt-3 text-sm">{labels.choose}</p>
          )}
        </div>
      </aside>
    </form>
  );
}

function rangeMessage(service: ServiceOption | undefined, labels: Record<string, string>) {
  if (!service) return undefined;
  return `${labels.min} ${service.min.toLocaleString()} — ${labels.max} ${service.max.toLocaleString()}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="muted min-w-0 text-[0.82rem]">{label}</dt>
      <dd className="shrink-0 text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
