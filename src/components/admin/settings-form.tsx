"use client";

import { useActionState } from "react";
import { saveSettingsAction, type ActionResult } from "@/app/actions/admin/config";
import { Field, TextInput } from "@/components/ui/field";
import ImageUpload from "@/components/admin/image-upload";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export type SettingField = {
  /** From the dictionary. Blank falls back to a name derived from the key. */
  label?: string;
  /** Only used by the image control, which has its own three strings. */
  hint?: string;
  uploadLabel?: string;
  removeLabel?: string;
  key: string;
  type: string;
  options?: string[];
  /** What each option is called. Missing entries show the stored value. */
  optionLabels?: Record<string, string>;
  value: unknown;
};

/**
 * Rendered from the setting registry rather than hand-written, so adding a
 * setting to the registry surfaces it here with no extra UI work.
 */
export default function SettingsForm({
  group,
  title,
  fields,
  labels,
}: {
  group: string;
  title: string;
  fields: SettingField[];
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(saveSettingsAction, {});

  return (
    <form action={action} className="card card-pad space-y-4">
      {/* Blank where the page already carries the heading — one section to a
          page now, so repeating its name inside the card says nothing. */}
      {title && <h3 className="font-semibold">{title}</h3>}

      {state.ok && (
        <div className="alert alert-success" role="status">
          <Icon name="checkCircle" size={16} />
          <span>{labels.saved}</span>
        </div>
      )}
      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      {fields.map((field) => (
        <div key={field.key}>
          <input type="hidden" name="__keys" value={field.key} />
          <SettingControl field={field} error={state.fieldErrors?.[field.key]} labels={labels} />
        </div>
      ))}

      <SubmitButton className="btn btn-primary">
        <Icon name="check" size={16} />
        {labels.save}
      </SubmitButton>

      <input type="hidden" name="__group" value={group} />
    </form>
  );
}

function SettingControl({
  field,
  error,
  labels,
}: {
  field: SettingField;
  error?: string;
  labels: Record<string, string>;
}) {
  // Named on the server where the dictionary lives; the derived name is what
  // a setting nobody has named yet still shows.
  const label = field.label || humanise(field.key);

  if (field.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name={field.key}
          defaultChecked={Boolean(field.value)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        {label}
      </label>
    );
  }

  if (field.type === "image") {
    return (
      <ImageUpload
        name={field.key}
        value={String(field.value ?? "")}
        label={label}
        hint={field.hint ?? ""}
        uploadLabel={field.uploadLabel ?? ""}
        removeLabel={field.removeLabel ?? ""}
      />
    );
  }

  if (field.type === "select") {
    return (
      <Field name={field.key} label={label} error={error}>
        <select id={field.key} name={field.key} className="field" defaultValue={String(field.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {field.optionLabels?.[o] ?? o}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (field.type === "textarea") {
    return (
      <Field name={field.key} label={label} error={error}>
        <textarea id={field.key} name={field.key} rows={3} className="field" defaultValue={String(field.value)} />
      </Field>
    );
  }

  if (field.type === "list") {
    return (
      <Field name={field.key} label={label} error={error} hint={labels.perLine}>
        <textarea
          id={field.key}
          name={field.key}
          rows={4}
          className="field"
          defaultValue={Array.isArray(field.value) ? field.value.join("\n") : ""}
        />
      </Field>
    );
  }

  if (field.type === "password") {
    // Blank means "keep the stored secret" — the same rule the payment method
    // credential fields use, so an admin can edit neighbours without retyping.
    return (
      <Field name={field.key} label={label} error={error}>
        <TextInput
          name={field.key}
          type="password"
          autoComplete="off"
          placeholder={field.value ? "\u2022".repeat(12) : ""}
          defaultValue=""
          error={error}
        />
      </Field>
    );
  }

  if (field.type === "json") {
    return (
      <Field name={field.key} label={label} error={error} hint={labels.json}>
        <textarea
          id={field.key}
          name={field.key}
          rows={6}
          spellCheck={false}
          className="field font-mono text-xs"
          defaultValue={JSON.stringify(field.value, null, 2)}
        />
      </Field>
    );
  }

  return (
    <Field name={field.key} label={label} error={error}>
      <TextInput
        name={field.key}
        type={field.type === "number" ? "number" : "text"}
        step={field.type === "number" ? "any" : undefined}
        defaultValue={String(field.value ?? "")}
        error={error}
      />
    </Field>
  );
}

/** "wallet.minDeposit" -> "Min deposit" */
function humanise(key: string) {
  const tail = key.split(".").slice(1).join(" ");
  const spaced = tail.replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
