"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { savePaymentMethodAction, testPaymentMethodAction, type ActionResult } from "@/app/actions/admin/config";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import CopyField from "@/components/ui/copy-field";
import ImageUpload from "@/components/admin/image-upload";
import MethodMark from "@/components/method-mark";
import { paginate } from "@/lib/paging";
import { Icon } from "@/components/icons";

const PER_PAGE = 8;

export type DriverField = { name: string; label: string; type?: string; options?: string[]; hint?: string };

export type MethodRow = {
  id: string;
  code: string;
  name: string;
  driver: string;
  icon: string;
  image: string;
  color: string;
  /** Where this gateway should be told to post, when it has a callback. */
  callbackUrl: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  currencies: string[];
  minAmount: number;
  maxAmount: number;
  feePercent: number;
  feeFixed: number;
  bonusPercent: number;
  position: number;
  /** Which config keys already hold a value; secrets themselves never leave the server. */
  filled: Record<string, boolean>;
  fields: DriverField[];
};

export default function PaymentMethodManager({
  rows,
  currencyCodes,
  labels,
}: {
  rows: MethodRow[];
  currencyCodes: string[];
  labels: Record<string, string>;
}) {
  const [editing, setEditing] = useState<MethodRow | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // Twenty-four methods and growing. Searching by name, code or driver is how
  // an operator finds one; the page size keeps the grid to a screenful.
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.code} ${r.driver}`.toLowerCase().includes(q));
  }, [rows, query]);

  // A search that shortens the list can leave the reader past the end of it,
  // which is why the page number is clamped rather than trusted.
  const { items: shown, page: current, pages } = paginate(found, page, PER_PAGE);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <span className="muted pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4">
            <Icon name="search" size={15} />
          </span>
          <label className="sr-only" htmlFor="method-search">
            {labels.search}
          </label>
          <input
            id="method-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={labels.search}
            className="field ps-11"
          />
        </div>
      </div>

      {found.length === 0 && <p className="muted card card-pad py-12 text-center text-sm">{labels.noneFound}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((row) => (
          <article key={row.id} className="card card-pad">
            <div className="flex items-start gap-3">
              <MethodMark method={row} box={40} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{row.name}</h3>
                <p className="muted font-mono text-xs">{row.code}</p>
              </div>
              <button type="button" onClick={() => setEditing(row)} className="btn btn-ghost btn-sm">
                <Icon name="settings" size={14} />
                {labels.configure}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={`badge ${row.enabled ? "badge-success" : "badge-muted"}`}>
                <Icon name={row.enabled ? "check" : "close"} size={11} />
                {row.enabled ? labels.enabled : labels.disabled}
              </span>
              <span className={`badge ${row.configured ? "badge-success" : "badge-warning"}`}>
                <Icon name={row.configured ? "check" : "alert"} size={11} />
                {row.configured ? labels.configured : labels.unconfigured}
              </span>
              {row.currencies.map((c) => (
                <span key={c} className="badge badge-muted">
                  {c}
                </span>
              ))}
            </div>

            {(row.feePercent > 0 || row.feeFixed > 0 || row.bonusPercent > 0) && (
              <p className="muted mt-3 text-xs">
                {row.feePercent > 0 || row.feeFixed > 0
                  ? `${labels.fee}: ${row.feePercent}% + ${row.feeFixed}`
                  : ""}
                {row.bonusPercent > 0 ? `  ·  ${labels.bonus}: ${row.bonusPercent}%` : ""}
              </p>
            )}
          </article>
        ))}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label={labels.title}>
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="btn btn-ghost btn-sm"
            aria-label={labels.previous}
          >
            <Icon name="chevronLeft" size={15} />
          </button>
          <span className="muted text-sm tabular-nums">
            {labels.pageOf.replace("{page}", String(current + 1)).replace("{pages}", String(pages))}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pages - 1}
            className="btn btn-ghost btn-sm"
            aria-label={labels.next}
          >
            <Icon name="chevronRight" size={15} />
          </button>
        </nav>
      )}

      <EntityDrawer closeLabel={labels.close} open={editing !== null} title={editing?.name ?? ""} onClose={() => setEditing(null)}>
        {editing && (
          <MethodForm
            key={editing.id}
            row={editing}
            currencyCodes={currencyCodes}
            labels={labels}
            onDone={() => setEditing(null)}
          />
        )}
      </EntityDrawer>
    </>
  );
}

function MethodForm({
  row,
  currencyCodes,
  labels,
  onDone,
}: {
  row: MethodRow;
  currencyCodes: string[];
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await savePaymentMethodAction(prev, form);
    if (result.ok) onDone();
    return result;
  }, {});

  // The test reads what is stored, not what is on screen, so an operator who
  // has just typed a key saves first. Saying so is better than testing the old
  // key and reporting success.
  const [probe, setProbe] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, startTest] = useTransition();

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={row.id} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setProbe(null);
            startTest(async () => setProbe(await testPaymentMethodAction(row.id)));
          }}
          disabled={testing}
          className="btn btn-ghost btn-sm"
        >
          <Icon name={testing ? "spinner" : "zap"} size={15} />
          {testing ? labels.testing : labels.testConnection}
        </button>
        <span className="muted text-xs">{labels.testHint}</span>
      </div>

      {probe && (
        <div className={`alert ${probe.ok ? "alert-success" : "alert-danger"}`} role="status">
          <Icon name={probe.ok ? "checkCircle" : "alert"} size={16} />
          <span>{probe.message}</span>
        </div>
      )}

      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      {row.callbackUrl && (
        <CopyField
          label={labels.webhookUrl}
          value={row.callbackUrl}
          copyLabel={labels.copy}
          copiedLabel={labels.copied}
          mono
        />
      )}

      <Field name="name" label={labels.name}>
        <TextInput name="name" defaultValue={row.name} />
      </Field>

      <ImageUpload
        name="image"
        value={row.image}
        label={labels.logo}
        hint={labels.logoHint}
        uploadLabel={labels.upload}
        removeLabel={labels.remove}
      />

      <Field name="color" label={labels.color}>
        <input
          id="color"
          name="color"
          type="color"
          defaultValue={row.color || "#6366f1"}
          className="field h-11 cursor-pointer p-1"
        />
      </Field>

      <Field name="description" label={labels.description}>
        <textarea id="description" name="description" rows={2} className="field" defaultValue={row.description} />
      </Field>

      <div>
        <span className="label">{labels.currencies}</span>
        <div className="flex flex-wrap gap-2">
          {currencyCodes.map((code) => (
            <label
              key={code}
              className="surface-2 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="currencies"
                value={code}
                defaultChecked={row.currencies.includes(code)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              {code}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="minAmount" label={labels.min}>
          <TextInput name="minAmount" type="number" step="any" defaultValue={String(row.minAmount)} />
        </Field>
        <Field name="maxAmount" label={labels.max}>
          <TextInput name="maxAmount" type="number" step="any" defaultValue={String(row.maxAmount)} />
        </Field>
        <Field name="feePercent" label={`${labels.fee} %`}>
          <TextInput name="feePercent" type="number" step="any" defaultValue={String(row.feePercent)} />
        </Field>
        <Field name="feeFixed" label={`${labels.fee} +`}>
          <TextInput name="feeFixed" type="number" step="any" defaultValue={String(row.feeFixed)} />
        </Field>
        <Field name="bonusPercent" label={`${labels.bonus} %`}>
          <TextInput name="bonusPercent" type="number" step="any" defaultValue={String(row.bonusPercent)} />
        </Field>
        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row.position)} />
        </Field>
      </div>

      <div className="divider" />

      <h3 className="text-sm font-semibold">{labels.credentials}</h3>
      {row.fields.map((field) => (
        <Field
          key={field.name}
          name={`config.${field.name}`}
          label={field.label}
          hint={field.type === "password" && row.filled[field.name] ? labels.secretSet : field.hint}
        >
          {field.type === "select" ? (
            <select id={`config.${field.name}`} name={`config.${field.name}`} className="field" defaultValue="">
              <option value="">—</option>
              {(field.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <TextInput
              name={`config.${field.name}`}
              type={field.type === "password" ? "password" : "text"}
              // Secrets are never sent to the browser; an empty submit keeps
              // whatever is already stored.
              placeholder={field.type === "password" && row.filled[field.name] ? "••••••••" : ""}
              autoComplete="off"
              hint={field.type === "password" && row.filled[field.name] ? labels.secretSet : field.hint}
            />
          )}
        </Field>
      ))}

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={row.enabled} className="h-4 w-4 accent-[var(--primary)]" />
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
