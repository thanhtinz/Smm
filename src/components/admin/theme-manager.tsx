"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteThemeAction,
  saveThemeAction,
  setDefaultThemeAction,
  type ActionResult,
} from "@/app/actions/admin/config";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type ThemeTokenSet = Record<string, string>;

export type ThemeRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  layout: string;
  enabled: boolean;
  isDefault: boolean;
  position: number;
  radius: string;
  font: string;
  light: ThemeTokenSet;
  dark: ThemeTokenSet;
};

const COLOR_TOKENS = [
  "bg",
  "surface",
  "surface2",
  "border",
  "text",
  "muted",
  "primary",
  "primaryFg",
  "accent",
  "success",
  "warning",
  "danger",
];

export default function ThemeManager({ rows, labels }: { rows: ThemeRow[]; labels: Record<string, string> }) {
  const [editing, setEditing] = useState<ThemeRow | null>(null);
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

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className="card overflow-hidden">
            {/* A live swatch strip beats a colour name: the operator sees the
                actual palette both modes will render with. */}
            <div className="grid grid-cols-2">
              {(["dark", "light"] as const).map((mode) => (
                <div key={mode} className="p-4" style={{ background: row[mode].bg, color: row[mode].text }}>
                  <p className="text-[0.62rem] font-semibold tracking-widest uppercase" style={{ color: row[mode].muted }}>
                    {labels[mode]}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {["primary", "accent", "success", "warning", "danger"].map((token) => (
                      <span
                        key={token}
                        className="h-6 w-6 rounded-md"
                        style={{ background: row[mode][token], border: `1px solid ${row[mode].border}` }}
                        title={token}
                      />
                    ))}
                  </div>
                  <p className="mt-2.5 rounded-md px-2 py-1 text-[0.68rem]" style={{ background: row[mode].surface2 }}>
                    {row.name}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.name}</p>
                <p className="muted truncate font-mono text-xs">{row.slug}</p>
              </div>
              {row.isDefault && <span className="badge badge-info">{labels.default}</span>}
              <span className={`badge ${row.enabled ? "badge-success" : "badge-muted"}`}>
                <Icon name={row.enabled ? "check" : "close"} size={11} />
                {row.enabled ? labels.enabled : labels.disabled}
              </span>
            </div>

            <div className="flex justify-end gap-1 border-t border-[var(--border)] px-4 py-2.5">
              {!row.isDefault && (
                <button
                  type="button"
                  onClick={() => run(() => setDefaultThemeAction(row.id))}
                  disabled={pending}
                  className="btn btn-ghost btn-sm"
                  title={labels.makeDefault}
                >
                  <Icon name="star" size={14} />
                </button>
              )}
              <button type="button" onClick={() => setEditing(row)} className="btn btn-ghost btn-sm">
                <Icon name="edit" size={14} />
                {labels.edit}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(labels.confirmDelete)) run(() => deleteThemeAction(row.id));
                }}
                disabled={pending || row.isDefault}
                className="btn btn-danger btn-sm"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>

      <EntityDrawer
        closeLabel={labels.close}
        open={creating || editing !== null}
        title={editing ? `${labels.edit} — ${editing.name}` : labels.new}
        onClose={close}
      >
        <ThemeForm key={editing?.id ?? "new"} row={editing} labels={labels} onDone={close} />
      </EntityDrawer>
    </>
  );
}

const BLANK: ThemeTokenSet = {
  bg: "#0a0a14",
  bgAccent: "none",
  surface: "#12121f",
  surface2: "#1a1a2b",
  border: "#272740",
  text: "#f2f2f7",
  muted: "#9494ad",
  primary: "#8b5cf6",
  primaryFg: "#ffffff",
  accent: "#22d3ee",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
};

function ThemeForm({
  row,
  labels,
  onDone,
}: {
  row: ThemeRow | null;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveThemeAction(prev, form);
    if (result.ok) onDone();
    return result;
  }, {});

  const dark = row?.dark ?? BLANK;
  const light = row?.light ?? { ...BLANK, bg: "#f7f7fb", surface: "#ffffff", surface2: "#f2f2f8", border: "#e3e3ee", text: "#15151f", muted: "#6b6b80" };

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
        <Field name="name" label={labels.name} error={state.fieldErrors?.name} required>
          <TextInput name="name" defaultValue={row?.name} error={state.fieldErrors?.name} placeholder={labels.egName} />
        </Field>
        <Field name="slug" label={labels.slug} error={state.fieldErrors?.slug} required>
          <TextInput name="slug" defaultValue={row?.slug} error={state.fieldErrors?.slug} placeholder="aurora" />
        </Field>
      </div>

      <Field name="description" label={labels.description}>
        <TextInput name="description" defaultValue={row?.description} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="radius" label={labels.radius}>
          <TextInput name="radius" defaultValue={row?.radius ?? "16px"} placeholder="16px" />
        </Field>
        <Field name="layout" label={labels.layout}>
          <select id="layout" name="layout" className="field" defaultValue={row?.layout ?? "classic"}>
            <option value="classic">classic</option>
            <option value="compact">compact</option>
            <option value="canvas">canvas</option>
          </select>
        </Field>
        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
        </Field>
      </div>

      <Field name="font" label={labels.font}>
        <TextInput name="font" defaultValue={row?.font} placeholder="'Inter', system-ui, sans-serif" />
      </Field>

      <TokenGrid mode="dark" title={labels.dark} values={dark} />
      <TokenGrid mode="light" title={labels.light} values={light} />

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={row?.enabled ?? true} className="h-4 w-4 accent-[var(--primary)]" />
        {labels.enabled}
      </label>

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

function TokenGrid({ mode, title, values }: { mode: "light" | "dark"; title: string; values: ThemeTokenSet }) {
  return (
    <fieldset>
      <legend className="label">{title}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {COLOR_TOKENS.map((token) => (
          <label key={token} className="surface-2 flex items-center gap-2 rounded-lg px-2.5 py-2">
            <input
              type="color"
              name={`${mode}.${token}`}
              defaultValue={values[token] ?? "#000000"}
              className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label={`${title} ${token}`}
            />
            <span className="muted truncate font-mono text-[0.68rem]">{token}</span>
          </label>
        ))}
      </div>
      <label className="mt-2 block">
        <span className="muted text-[0.68rem]">bgAccent</span>
        <input
          name={`${mode}.bgAccent`}
          defaultValue={values.bgAccent ?? "none"}
          className="field mt-1 font-mono text-xs"
          spellCheck={false}
        />
      </label>
    </fieldset>
  );
}
