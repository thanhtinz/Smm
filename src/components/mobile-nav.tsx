"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { isActive } from "@/components/nav-link";

/**
 * Bottom navigation for small screens. Capped at five destinations — beyond
 * that the targets get too small and the hierarchy stops being readable.
 */
export default function MobileNav({
  items,
  label,
}: {
  items: { href: string; label: string; icon: IconName; exact?: boolean }[];
  /** What this navigation is, for a screen reader. */
  label: string;
}) {
  const pathname = usePathname();
  const visible = items.slice(0, 5);

  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {visible.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.68rem] font-medium transition-colors ${
                  active ? "text-[var(--primary)]" : "muted"
                }`}
              >
                <Icon name={item.icon} size={19} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
