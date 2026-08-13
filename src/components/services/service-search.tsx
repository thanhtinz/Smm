"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";

/**
 * Debounced search. Typing rewrites the query string rather than holding
 * results in component state, so a search is linkable and survives reload.
 */
export default function ServiceSearch({
  placeholder,
  defaultValue,
}: {
  placeholder: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (value === defaultValue) return;
    const id = setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value.trim()) sp.set("q", value.trim());
      else sp.delete("q");
      start(() => router.replace(sp.toString() ? `${pathname}?${sp}` : pathname, { scroll: false }));
    }, 300);
    return () => clearTimeout(id);
  }, [value, defaultValue, pathname, router, searchParams]);

  return (
    <div className="relative">
      <span className="muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2">
        <Icon name="search" size={17} />
      </span>
      <label htmlFor="service-search" className="sr-only">
        {placeholder}
      </label>
      <input
        id="service-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="field pl-11"
        autoComplete="off"
      />
      {pending && (
        <span className="muted absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin" aria-hidden>
          <Icon name="spinner" size={16} />
        </span>
      )}
    </div>
  );
}
