"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";

/**
 * Slide-over used by every admin editor. Rendered to <body> so the panel is
 * never trapped inside a card's backdrop-filter stacking context.
 */
export default function EntityDrawer({
  open,
  title,
  onClose,
  children,
  closeLabel,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Named by the caller: a client component has no dictionary of its own. */
  closeLabel: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end">
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-lg flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label={closeLabel}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
