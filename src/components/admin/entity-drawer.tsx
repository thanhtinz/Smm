"use client";

import { useEffect, useRef } from "react";
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
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Escape, the scroll lock, and the two things a modal actually has to do
   * that this was missing: put focus inside itself, and keep it there.
   *
   * It had `aria-modal="true"` and neither. Every admin editor opened with
   * focus still on the row button behind the overlay, so a keyboard user
   * pressing Tab walked through the obscured page underneath while the drawer
   * sat open in front of them — and could edit a form they could not see.
   */
  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    // The first control rather than the panel itself, so the reader lands on
    // something they can act on.
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // Wrapped by hand: the browser's own Tab order does not know the page
      // behind the overlay is off limits.
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      // Back where they were, so closing an editor does not lose the row.
      opener?.focus?.();
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-lg flex-col border-s border-[var(--border)] bg-[var(--surface)] shadow-2xl"
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
