"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";

export type NavLink = {
  href: string;
  label: string;
  /** Drawn before the label — a platform's mark in the platform menus. */
  icon?: React.ReactNode;
  /** A platform's categories. Present turns the bar entry into a dropdown. */
  children?: { href: string; label: string }[];
  /** What the link to the parent's own page is called inside the dropdown. */
  allLabel?: string;
};

/**
 * The header's navigation on a narrow screen.
 *
 * The links were simply hidden below `lg`, which left a phone with no way to
 * reach the services list, the API docs or the terms at all. They live in a
 * sheet behind one button now, along with the preferences and the account
 * buttons that also come off the bar at that width.
 */
export default function SiteMenu({
  links,
  children,
  labels,
}: {
  links: NavLink[];
  /** Preferences and the sign-in buttons, repeated inside the sheet. */
  children: React.ReactNode;
  labels: { open: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  // Portals need a document, which the first server render does not have.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pathname = usePathname();

  // Navigating is the one thing the sheet exists for, so it closes itself
  // rather than staying over the page that was just opened.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // The sheet scrolls on its own; the page behind it should not.
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const link = (item: NavLink) => {
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          active ? "bg-[var(--surface2)] text-[var(--text)]" : "muted hover:bg-[var(--surface2)] hover:text-[var(--text)]"
        }`}
      >
        {item.icon}
        {item.label}
      </Link>
    );
  };

  /**
   * In the sheet a platform's categories are laid out rather than hidden
   * behind a second tap. There is a whole screen of room here, and a menu that
   * makes a phone open two panels to reach a page is the thing this sheet
   * exists to avoid.
   */
  const group = (item: NavLink) =>
    item.children?.length ? (
      <div key={item.href} className="pt-1">
        {link(item)}
        <div className="ml-4 border-l border-[var(--border)] pl-2">
          {item.children.map((child) => link(child))}
        </div>
      </div>
    ) : (
      link(item)
    );

  return (
    <>
      <button
        type="button"
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost btn-sm ring-focus"
      >
        <Icon name={open ? "close" : "menu"} size={18} />
      </button>

      {/* Rendered on the body rather than in place: the header carries a
          backdrop filter, which makes it the containing block for anything
          fixed inside it, and the sheet would be sized against its 64px. */}
      {open &&
        mounted &&
        createPortal(
        <div className="fixed inset-x-0 top-16 bottom-0 z-40">
          <button
            type="button"
            aria-label={labels.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] backdrop-blur-sm"
          />
          <div
            className="relative max-h-full overflow-y-auto border-b border-[var(--border)] px-4 py-4 shadow-2xl"
            style={{ background: "var(--bg)" }}
          >
            <nav className="space-y-0.5">{links.map(group)}</nav>
            <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">{children}</div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
