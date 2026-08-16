"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  deleteLanguageAction,
  saveLanguageAction,
  saveTranslationsAction,
  type ActionResult,
} from "@/app/actions/admin/config";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type LanguageRow = {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  direction: string;
  enabled: boolean;
  position: number;
  translatedCount: number;
};

export default function LanguageManager({
  rows,
  keys,
  fallbacks,
  values,
  labels,
}: {
  rows: LanguageRow[];
  /** Every key the UI can render, from the bundled base dictionary. */
  keys: string[];
  /** languageId -> key -> the string in effect today for that language. */
  fallbacks: Record<string, Record<string, string>>;
  /** languageId -> key -> stored override. */
  values: Record<string, Record<string, string>>;
  labels: Record<string, string>;
}) {
  const [editing, setEditing] = useState<LanguageRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [translating, setTranslating] = useState<LanguageRow | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
    setTranslating(null);
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
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th className="w-24">{labels.code}</th>
                <th>{labels.name}</th>
                <th className="w-44">{labels.translations}</th>
                <th className="w-28">{labels.status}</th>
                <th className="w-40 text-end">{labels.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pct = keys.length ? Math.round((row.translatedCount / keys.length) * 100) : 0;
                return (
                  <tr key={row.id}>
                    <td className="font-mono font-semibold">{row.code}</td>
                    <td>
                      <span className="font-medium">{row.nativeName}</span>
                      <span className="muted mt-0.5 block text-xs">{row.name}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="surface-2 h-1.5 flex-1 overflow-hidden rounded-full">
                          <span
                            className="block h-full rounded-full bg-[var(--primary)]"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="muted shrink-0 text-xs tabular-nums">{pct}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${row.enabled ? "badge-success" : "badge-muted"}`}>
                        <Icon name={row.enabled ? "check" : "close"} size={11} />
                        {row.enabled ? labels.enabled : labels.disabled}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setTranslating(row)}
                          className="btn btn-ghost btn-sm"
                          title={labels.translations}
                        >
                          <Icon name="language" size={14} />
                        </button>
                        <button type="button" onClick={() => setEditing(row)} className="btn btn-ghost btn-sm">
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(labels.confirmDelete)) return;
                            setError("");
                            start(async () => {
                              const result = await deleteLanguageAction(row.id);
                              if (result.error) setError(result.error);
                            });
                          }}
                          disabled={pending}
                          className="btn btn-danger btn-sm"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
        <LanguageForm key={editing?.id ?? "new"} row={editing} labels={labels} onDone={close} />
      </EntityDrawer>

      <EntityDrawer
        closeLabel={labels.close}
        open={translating !== null}
        title={`${labels.translations} — ${translating?.nativeName ?? ""}`}
        onClose={close}
      >
        {translating && (
          <TranslationEditor
            key={translating.id}
            language={translating}
            keys={keys}
            fallbacks={fallbacks[translating.id] ?? {}}
            values={values[translating.id] ?? {}}
            labels={labels}
            onDone={close}
          />
        )}
      </EntityDrawer>
    </>
  );
}

function LanguageForm({
  row,
  labels,
  onDone,
}: {
  row: LanguageRow | null;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveLanguageAction(prev, form);
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

      <Field name="code" label={labels.code} error={state.fieldErrors?.code} required>
        <TextInput name="code" defaultValue={row?.code} error={state.fieldErrors?.code} placeholder="es" />
      </Field>

      <Field name="name" label={labels.name} required>
        <TextInput name="name" defaultValue={row?.name} placeholder={labels.egName} />
      </Field>

      <Field name="nativeName" label={labels.nativeName} required>
        <TextInput name="nativeName" defaultValue={row?.nativeName} placeholder={labels.egNative} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="direction" label={labels.direction}>
          <select id="direction" name="direction" className="field" defaultValue={row?.direction ?? "ltr"}>
            <option value="ltr">ltr</option>
            <option value="rtl">rtl</option>
          </select>
        </Field>
        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
        </Field>
      </div>

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

function TranslationEditor({
  language,
  keys,
  fallbacks,
  values,
  labels,
  onDone,
}: {
  language: LanguageRow;
  keys: string[];
  fallbacks: Record<string, string>;
  values: Record<string, string>;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveTranslationsAction(prev, form);
    if (result.ok) onDone();
    return result;
  }, {});

  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) => k.toLowerCase().includes(q) || (fallbacks[k] ?? "").toLowerCase().includes(q));
  }, [keys, fallbacks, query]);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="languageId" value={language.id} />

      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <div className="relative">
        <span className="muted pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2">
          <Icon name="search" size={16} />
        </span>
        <label htmlFor="key-search" className="sr-only">
          {labels.searchKeys}
        </label>
        <input
          id="key-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.searchKeys}
          className="field ps-11"
        />
      </div>

      <p className="form-hint">{labels.fallbackHint}</p>

      {/* Every key stays mounted so a filtered save still submits the rest
          unchanged rather than wiping them. */}
      <div className="space-y-3">
        {keys.map((key) => (
          <div key={key} hidden={!visible.includes(key)}>
            <label htmlFor={`t.${key}`} className="label font-mono text-[0.68rem] normal-case">
              {key}
            </label>
            <p className="muted mb-1 text-xs">{fallbacks[key]}</p>
            <input
              id={`t.${key}`}
              name={`t.${key}`}
              defaultValue={values[key] ?? ""}
              placeholder={fallbacks[key]}
              className="field"
            />
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-[var(--border)] bg-[var(--surface)] py-3">
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
