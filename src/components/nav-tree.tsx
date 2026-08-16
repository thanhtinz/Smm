"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import PlatformMark, { type PlatformLike } from "@/components/platform-mark";

export type TreePlatform = PlatformLike & {
  slug: string;
  categories: { slug: string; name: string }[];
};

/**
 * The catalogue, in the sidebar.
 *
 * This is the navigation this market's customers already know: the platform
 * first, then the thing they want done to it, and the second click is already
 * on the order form. Putting it here rather than only in the public header is
 * the point — somebody who has signed in and topped up is not browsing a
 * brochure, they are buying, and the buying pages should be one click from
 * wherever they are in the panel.
 *
 * A platform opens on click and stays open while you are inside it, so
 * ordering a second thing from the same platform does not mean opening it
 * again. Only one is open at a time: eight platforms with their categories
 * expanded is a sidebar nobody can scan.
 */
export default function NavTree({ platforms, title }: { platforms: TreePlatform[]; title: string }) {
  const pathname = usePathname();

  // Whichever platform the current page belongs to, unless the reader has
  // since opened another one — and the "since" is what was missing.
  //
  // `opened` was set once and never cleared, and NavTree lives in the
  // dashboard layout, which is never remounted. So: expand Instagram, collapse
  // it — that stores "" rather than null, which is falsy but not nullish, so
  // ?? kept it — then navigate to a TikTok category from a reorder link. The
  // sidebar refused to expand the platform the reader was standing in. The
  // choice is forgotten when the page changes, so following a link always
  // opens where you landed and clicking a platform still overrides it.
  const current = platforms.find((p) => pathname.startsWith(`/dashboard/order/${p.slug}/`))?.slug ?? "";
  const [opened, setOpened] = useState<string | null>(null);
  const [at, setAt] = useState(pathname);
  if (at !== pathname) {
    setAt(pathname);
    setOpened(null);
  }
  const open = opened ?? current;

  if (platforms.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="muted px-3 pb-2 text-[0.67rem] font-semibold tracking-widest uppercase">{title}</p>
      <ul className="space-y-0.5">
        {platforms.map((platform) => {
          const expanded = open === platform.slug;
          const inside = pathname.startsWith(`/dashboard/order/${platform.slug}/`);
          return (
            <li key={platform.slug}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpened(expanded ? "" : platform.slug)}
                className={`ring-focus flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  inside
                    ? "text-[var(--text)]"
                    : "muted hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                }`}
              >
                <PlatformMark platform={platform} size={18} />
                <span className="flex-1 truncate text-left">{platform.name}</span>
                <Icon
                  name="chevronDown"
                  size={15}
                  className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>

              {expanded && (
                <ul className="mt-0.5 ms-6 space-y-0.5 border-s border-[var(--border)] ps-2">
                  {platform.categories.map((category) => {
                    const href = `/dashboard/order/${platform.slug}/${category.slug}`;
                    const active = pathname === href;
                    return (
                      <li key={category.slug}>
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                            active
                              ? "bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] font-medium text-[var(--primary)]"
                              : "muted hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                          }`}
                        >
                          {category.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
