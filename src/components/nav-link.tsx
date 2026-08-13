"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

export function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLink({
  href,
  label,
  icon,
  badge,
  exact,
}: {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href, exact);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
          : "muted hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      }`}
    >
      <Icon name={icon} size={18} />
      <span className="flex-1">{label}</span>
      {badge ? <span className="badge badge-info">{badge}</span> : null}
    </Link>
  );
}
