"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { logoutAction } from "@/app/actions/auth";

export default function UserMenu(props: {
  username: string;
  email: string;
  role: string;
  /** Passed down: this is a client component, so it has no dictionary. */
  labels: Record<"profile" | "wallet" | "apiKey" | "admin" | "signOut", string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = props.username.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="ring-focus flex items-center gap-2 rounded-full border border-[var(--border)] py-1 pr-2.5 pl-1 transition-colors hover:bg-[var(--surface2)]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary)_22%,transparent)] text-xs font-bold text-[var(--primary)]">
          {initials}
        </span>
        <span className="hidden text-sm font-medium sm:inline">{props.username}</span>
        <Icon name="chevronDown" size={14} />
      </button>

      {open && (
        <div role="menu" className="popover absolute right-0 z-50 mt-2 w-64 overflow-hidden p-1.5 shadow-2xl">
          <div className="border-b border-[var(--border)] px-3 py-3">
            <p className="truncate text-sm font-semibold">{props.username}</p>
            <p className="muted truncate text-xs">{props.email}</p>
          </div>

          <div className="py-1">
            <MenuLink href="/dashboard/profile" icon="user" label={props.labels.profile} onNavigate={() => setOpen(false)} />
            <MenuLink href="/dashboard/wallet" icon="wallet" label={props.labels.wallet} onNavigate={() => setOpen(false)} />
            <MenuLink href="/dashboard/api" icon="key" label={props.labels.apiKey} onNavigate={() => setOpen(false)} />
            {props.role === "admin" && (
              <MenuLink href="/admin" icon="shield" label={props.labels.admin} onNavigate={() => setOpen(false)} />
            )}
          </div>

          <form action={logoutAction} className="border-t border-[var(--border)] pt-1">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
            >
              <Icon name="logout" size={17} />
              {props.labels.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--surface2)]"
    >
      <Icon name={icon} size={17} />
      {label}
    </Link>
  );
}
