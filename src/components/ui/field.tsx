import { Icon } from "@/components/icons";

/**
 * Labelled input. The label is always visible (never a placeholder standing in
 * for one) and errors render directly beneath the control they belong to.
 */
export function Field({
  name,
  label,
  error,
  hint,
  children,
  required,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
        {required && (
          <span className="ml-1 text-[var(--danger)]" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="form-error" id={`${name}-error`} role="alert">
          <Icon name="alert" size={14} />
          <span>{error}</span>
        </p>
      )}
      {!error && hint && (
        <p className="form-hint" id={`${name}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  name,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string; error?: string; hint?: string }) {
  return (
    <input
      {...props}
      id={name}
      name={name}
      className="field"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
    />
  );
}
