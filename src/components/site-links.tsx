"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { NavLink } from "@/components/site-nav";

/**
 * The header links in the bar itself, from `md` up.
 *
 * A platform per entry means the bar's length is set by the catalogue, not by
 * this file: eight platforms overflow a laptop, and a panel is free to sell
 * twenty. So the row measures itself and moves whatever does not fit into one
 * overflow menu at the end. The measuring copy is always rendered — hidden and
 * out of flow — because measuring the visible row would need it laid out at
 * full width first, which is the flash it is there to avoid.
 */
export default function SiteLinks({ links, moreLabel }: { links: NavLink[]; moreLabel: string }) {
  const pathname = usePathname();
  const row = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(links.length);

  useLayoutEffect(() => {
    const measure = () => {
      if (!row.current || !ghost.current) return;
      const widths = Array.from(ghost.current.children).map((el) => (el as HTMLElement).offsetWidth);
      const available = row.current.clientWidth;

      // Room kept for the overflow button, but only while there is an
      // overflow — otherwise the last entry is pushed out to make space for a
      // button that would then have nothing in it.
      let used = 0;
      let fit = 0;
      for (const width of widths) {
        if (used + width > available) break;
        used += width;
        fit++;
      }
      if (fit < widths.length) {
        const MORE = 92;
        while (fit > 0 && used + MORE > available) used -= widths[--fit];
      }
      setShown(fit);
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (row.current) observer.observe(row.current);
    return () => observer.disconnect();
  }, [links]);

  const overflow = links.slice(shown);

  return (
    <div className="relative hidden min-w-0 md:block">
      {/* The measuring copy: laid out at its natural width, never painted,
          never reachable by a pointer or a keyboard. */}
      <div
        ref={ghost}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex"
      >
        {links.map((item) => (
          <Entry key={item.href} item={item} pathname={pathname} measuring />
        ))}
      </div>

      <nav ref={row} className="flex min-w-0 items-center gap-0.5 overflow-hidden">
        {links.slice(0, shown).map((item) => (
          <Entry key={item.href} item={item} pathname={pathname} />
        ))}
        {overflow.length > 0 && (
          <Entry
            key="__more"
            pathname={pathname}
            item={{
              href: "/services",
              label: moreLabel,
              allLabel: "",
              children: overflow.map((item) => ({ href: item.href, label: item.label })),
            }}
          />
        )}
      </nav>
    </div>
  );
}

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

const ENTRY = "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors";

function Entry({ item, pathname, measuring }: { item: NavLink; pathname: string; measuring?: boolean }) {
  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        aria-current={isActive(item.href, pathname) ? "page" : undefined}
        tabIndex={measuring ? -1 : undefined}
        className={`${ENTRY} ${
          isActive(item.href, pathname)
            ? "bg-[var(--surface2)] text-[var(--text)]"
            : "muted hover:bg-[var(--surface2)] hover:text-[var(--text)]"
        }`}
      >
        {item.icon}
        {item.label}
      </Link>
    );
  }
  return <Dropdown item={item} pathname={pathname} measuring={measuring} />;
}

/**
 * A platform, opening onto its categories.
 *
 * Two devices, two behaviours, and mixing them is the bug this shape avoids.
 * Where there is a pointer, hovering shows the categories and clicking the
 * platform goes to the platform's own page — the menu is already open by
 * then, so a click that closed it again would be the pointer undoing its own
 * hover, which is exactly what happens when hover and toggle share a control.
 * Where there is no pointer, the tap has to do the opening, so it toggles the
 * panel instead of following the link.
 *
 * The element is a link either way, so the markup does not change between the
 * server's render and the browser's, and a keyboard reaches both the platform
 * page (Enter) and the categories (focus opens the panel, Escape closes it).
 */
function Dropdown({ item, pathname, measuring }: { item: NavLink; pathname: string; measuring?: boolean }) {
  const [open, setOpen] = useState(false);
  // Undecided until the browser says; the server cannot know, and guessing
  // would make the first click behave differently from every one after it.
  const [hoverable, setHoverable] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setHoverable(window.matchMedia("(hover: hover)").matches), []);

  // Arriving somewhere is the whole point, so the panel does not stay open
  // over the page it just opened.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = isActive(item.href, pathname);

  return (
    <div
      ref={box}
      className="relative"
      onMouseEnter={hoverable ? () => setOpen(true) : undefined}
      onMouseLeave={hoverable ? () => setOpen(false) : undefined}
    >
      <Link
        href={item.href}
        aria-expanded={open}
        aria-haspopup="true"
        aria-current={active ? "page" : undefined}
        tabIndex={measuring ? -1 : undefined}
        onFocus={() => setOpen(true)}
        onClick={(e) => {
          if (hoverable) return;
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={`ring-focus ${ENTRY} ${
          active || open
            ? "bg-[var(--surface2)] text-[var(--text)]"
            : "muted hover:bg-[var(--surface2)] hover:text-[var(--text)]"
        }`}
      >
        {item.icon}
        {item.label}
        <Icon
          name="chevronDown"
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Link>

      {open && !measuring && (
        <div className="popover absolute top-full left-0 z-50 mt-1 max-h-[70vh] w-60 overflow-y-auto py-1 shadow-xl">
          {/* The platform's own page stays reachable: the categories are the
              reason to open this, but "everything on TikTok" is a page
              somebody still wants. */}
          {item.allLabel && (
            <>
              <Link
                href={item.href}
                className="muted flex items-center gap-2 px-3.5 py-2 text-sm hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              >
                {item.allLabel}
                <Icon name="arrowRight" size={13} className="ml-auto" />
              </Link>
              <div className="divider my-1" />
            </>
          )}
          {item.children!.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              aria-current={pathname === child.href ? "page" : undefined}
              className={`block px-3.5 py-2 text-sm transition-colors ${
                pathname === child.href
                  ? "bg-[var(--surface2)] text-[var(--text)]"
                  : "muted hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              }`}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
