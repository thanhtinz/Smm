"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavLink, { isActive } from "@/components/nav-link";
import type { IconName } from "@/components/icons";

export type NavChild = { href: string; label: string };

/**
 * A nav entry with its own pages under it.
 *
 * Settings is a page per section now, and a row of tabs inside the page was
 * the wrong place to list them: the panel already has one primary navigation
 * and the sections are pages, so they belong in it beside everything else.
 *
 * Open only while the reader is inside the branch, which is the same rule the
 * catalogue tree follows. Thirteen sections permanently expanded would be a
 * sidebar nobody can scan, and collapsed-with-a-toggle would hide them behind
 * a click for the one moment they are useful.
 */
export default function NavBranch({
  href,
  label,
  icon,
  exact,
  sections,
}: {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  sections: NavChild[];
}) {
  const pathname = usePathname();
  const inside = isActive(pathname, href, exact);

  return (
    <>
      <NavLink href={href} label={label} icon={icon} exact={exact} />
      {inside && sections.length > 0 && (
        <ul className="mt-0.5 ms-6 space-y-0.5 border-s border-[var(--border)] ps-2">
          {sections.map((child) => {
            const active = pathname === child.href;
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={active ? "page" : undefined}
                  className={`ring-focus block rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[color-mix(in_srgb,var(--primary)_13%,transparent)] font-medium text-[var(--primary)]"
                      : "muted hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                  }`}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
