"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "@/components/icons";

/**
 * Submit control that reports pending state, so no action can be fired twice
 * and the user always gets feedback within the first frame.
 */
export default function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingLabel,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  /** Set both when one form has more than one thing it can do. */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="inline-flex animate-spin">
            <Icon name="spinner" size={16} />
          </span>
          {pendingLabel ?? "…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
