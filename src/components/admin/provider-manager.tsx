"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  deleteProviderAction,
  dispatchOrdersAction,
  syncProviderPricesAction,
  refreshProviderBalanceAction,
  saveProviderAction,
  syncStatusesAction,
  type ActionResult,
  type SyncResult,
} from "@/app/actions/admin/providers";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";
import { formatCount } from "@/lib/numbers";

export type ProviderRow = {
  id: string;
  name: string;
  /** What staff see instead of the name, everywhere but this page. */
  alias: string;
  apiUrl: string;
  currency: string;
  balance: number;
  enabled: boolean;
  serviceCount: number;
  lastSyncAt: string;
  autoSync: boolean;
  syncEveryHours: number;
  markupPercent: number;
  alertPercent: number;
  lowBalance: number;
  /** How this one has actually been behaving, over the settings' window. */
  health: {
    taken: number;
    completed: number;
    partial: number;
    failed: number;
    running: number;
    successRate: number | null;
    speed: string;
    spend: string;
    /** The services going worst here, worst first. */
    worst: { publicId: number; name: string; rate: number; settled: number }[];
  };
};

export default function ProviderManager({
  rows,
  labels,
  locale,
}: {
  rows: ProviderRow[];
  labels: Record<string, string>;
  /** Counts are grouped the reader's way, not the server's. */
  locale: string;
}) {
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const run = (fn: () => Promise<SyncResult>) => {
    setNotice(null);
    start(async () => {
      const result = await fn();
      if (result.error) setNotice({ tone: "bad", text: result.error });
      else setNotice({ tone: "ok", text: result.message ?? labels.done });
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => run(dispatchOrdersAction)} disabled={pending} className="btn btn-ghost btn-sm">
            <Icon name="send" size={15} />
            {labels.dispatch}
          </button>
          <button type="button" onClick={() => run(syncStatusesAction)} disabled={pending} className="btn btn-ghost btn-sm">
            <Icon name="refresh" size={15} />
            {labels.syncStatuses}
          </button>
          <button type="button" onClick={() => setCreating(true)} className="btn btn-primary btn-sm">
            <Icon name="plus" size={15} />
            {labels.new}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`alert ${notice.tone === "ok" ? "alert-success" : "alert-danger"}`} role="status">
          <Icon name={notice.tone === "ok" ? "checkCircle" : "alert"} size={16} />
          <span>{notice.text}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card card-pad py-14 text-center">
          <span className="muted inline-flex">
            <Icon name="server" size={30} />
          </span>
          <p className="muted mt-3 text-sm">{labels.empty}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="card card-pad">
              <div className="flex items-start gap-3">
                <span className="surface-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon name="server" size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{row.name}</h3>
                  <p className="muted truncate font-mono text-xs">{row.apiUrl}</p>
                </div>
                <span className={`badge ${row.enabled ? "badge-success" : "badge-muted"}`}>
                  <Icon name={row.enabled ? "check" : "close"} size={11} />
                  {row.enabled ? labels.enabled : labels.disabled}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <Row label={labels.balance} value={`${formatCount(row.balance, locale)} ${row.currency}`} />
                <Row label={labels.services} value={String(row.serviceCount)} />
                <Row label={labels.lastSync} value={row.lastSyncAt || "—"} />
                <Row
                  label={labels.autoSync}
                  value={
                    row.autoSync
                      ? labels.autoSyncEvery.replace("{hours}", String(row.syncEveryHours))
                      : labels.off
                  }
                />
                <Row label={labels.markup} value={`${row.markupPercent}%`} />
              </dl>

              <Health row={row} labels={labels} />

              <div className="mt-4 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => run(() => refreshProviderBalanceAction(row.id))}
                  disabled={pending}
                  className="btn btn-ghost btn-sm"
                >
                  <Icon name="wallet" size={14} />
                  {labels.checkBalance}
                </button>
                <button
                  type="button"
                  onClick={() => run(() => syncProviderPricesAction(row.id))}
                  disabled={pending}
                  className="btn btn-ghost btn-sm"
                >
                  <Icon name="refresh" size={14} />
                  {labels.syncPrices}
                </button>
                <Link href={`/admin/providers/import?provider=${row.id}`} className="btn btn-ghost btn-sm">
                  <Icon name="download" size={14} />
                  {labels.import}
                </Link>
                <button type="button" onClick={() => setEditing(row)} className="btn btn-ghost btn-sm">
                  <Icon name="edit" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(labels.confirmDelete)) run(() => deleteProviderAction(row.id));
                  }}
                  disabled={pending}
                  className="btn btn-danger btn-sm"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <EntityDrawer
        closeLabel={labels.close}
        open={creating || editing !== null}
        title={editing ? `${labels.edit} — ${editing.name}` : labels.new}
        onClose={close}
      >
        <ProviderForm key={editing?.id ?? "new"} row={editing} labels={labels} onDone={close} />
      </EntityDrawer>
    </>
  );
}

function ProviderForm({
  row,
  labels,
  onDone,
}: {
  row: ProviderRow | null;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveProviderAction(prev, form);
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

      <Field name="name" label={labels.name} error={state.fieldErrors?.name} required>
        <TextInput name="name" defaultValue={row?.name} error={state.fieldErrors?.name} placeholder={labels.egName} />
      </Field>

      {/* The one place the real name and the host are shown. Everywhere else
          reads providerLabel, which prefers this. */}
      <Field name="alias" label={labels.alias} hint={labels.aliasHint}>
        <TextInput name="alias" defaultValue={row?.alias} hint={labels.aliasHint} placeholder={labels.egAlias} />
      </Field>

      <Field name="apiUrl" label={labels.apiUrl} error={state.fieldErrors?.apiUrl} required>
        <TextInput
          name="apiUrl"
          type="url"
          defaultValue={row?.apiUrl}
          error={state.fieldErrors?.apiUrl}
          placeholder="https://provider.example/api/v2"
        />
      </Field>

      <Field
        name="apiKey"
        label={labels.apiKey}
        error={state.fieldErrors?.apiKey}
        hint={row ? labels.secretSet : undefined}
        required={!row}
      >
        <TextInput
          name="apiKey"
          type="password"
          autoComplete="off"
          error={state.fieldErrors?.apiKey}
          hint={row ? labels.secretSet : undefined}
          placeholder={row ? "••••••••" : ""}
        />
      </Field>

      <Field name="currency" label={labels.currency}>
        <TextInput name="currency" defaultValue={row?.currency ?? "USD"} maxLength={3} placeholder="USD" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="markupPercent" label={labels.markup} hint={labels.markupHint}>
          <TextInput
            name="markupPercent"
            type="number"
            step="any"
            defaultValue={String(row?.markupPercent ?? 60)}
            hint={labels.markupHint}
          />
        </Field>
        <Field name="syncEveryHours" label={labels.syncEvery} hint={labels.syncEveryHint}>
          <TextInput
            name="syncEveryHours"
            type="number"
            min={1}
            defaultValue={String(row?.syncEveryHours ?? 12)}
            hint={labels.syncEveryHint}
          />
        </Field>
        <Field name="alertPercent" label={labels.alert} hint={labels.alertHint}>
          <TextInput
            name="alertPercent"
            type="number"
            step="any"
            min={0}
            defaultValue={String(row?.alertPercent ?? 25)}
            hint={labels.alertHint}
          />
        </Field>
        <Field name="lowBalance" label={labels.lowBalance} hint={labels.lowBalanceHint}>
          <TextInput
            name="lowBalance"
            type="number"
            step="any"
            min={0}
            defaultValue={String(row?.lowBalance ?? 0)}
            hint={labels.lowBalanceHint}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="autoSync"
          defaultChecked={row?.autoSync ?? false}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        {labels.autoSyncOn}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="muted text-[0.82rem]">{label}</dt>
      <dd className="shrink-0 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * What the orders say about this provider. Nothing here is configured — it is
 * read back from what actually happened, which is the point: a supplier that
 * has quietly gone bad still looks fine in its own settings.
 */
function Health({ row, labels }: { row: ProviderRow; labels: Record<string, string> }) {
  const h = row.health;
  if (h.taken === 0) {
    return (
      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <p className="muted text-xs">{labels.healthNone}</p>
      </div>
    );
  }

  // Colour by how bad it is, not by a fixed scale: an operator scanning a
  // page of providers should see the one worth opening.
  const tone =
    h.successRate === null ? "muted" : h.successRate >= 90 ? "success" : h.successRate >= 70 ? "warning" : "danger";

  return (
    <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="muted text-[0.68rem] font-semibold tracking-widest uppercase">{labels.healthTitle}</span>
        {h.successRate !== null && (
          <span className={`badge badge-${tone === "muted" ? "muted" : tone}`}>{h.successRate}%</span>
        )}
      </div>

      <dl className="space-y-2 text-sm">
        <Row label={labels.healthTaken} value={String(h.taken)} />
        <Row
          label={labels.healthOutcome}
          value={`${h.completed} / ${h.partial} / ${h.failed}${h.running ? ` (+${h.running})` : ""}`}
        />
        <Row label={labels.healthSpeed} value={h.speed} />
        <Row label={labels.healthSpend} value={h.spend} />
      </dl>

      {h.worst.length > 0 && (
        <details>
          <summary className="muted cursor-pointer text-xs">{labels.healthWorst}</summary>
          <ul className="mt-1.5 space-y-1">
            {h.worst.map((s) => (
              <li key={s.publicId} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="muted min-w-0 truncate">
                  #{s.publicId} {s.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  {s.rate}% · {s.settled}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
