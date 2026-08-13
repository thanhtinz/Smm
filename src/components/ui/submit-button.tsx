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
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
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
