"use client";

import { useActionState } from "react";
import { saveToolsAction, type ActionResult } from "@/app/actions/admin/tools";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export type ToolRow = { slug: string; group: string; name: string; about: string; enabled: boolean };

export default function ToolsForm({
  groups,
  rows,
  labels,
}: {
  groups: { key: string; label: string }[];
  rows: ToolRow[];
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(saveToolsAction, {});

  return (
    <form action={action} className="space-y-6">
      {groups.map((group) => {
        const inGroup = rows.filter((r) => r.group === group.key);
        if (!inGroup.length) return null;

        return (
          <section key={group.key} className="card overflow-hidden">
            <h3 className="muted border-b border-[var(--border)] px-5 py-3 text-xs font-semibold tracking-[0.16em] uppercase">
              {group.label}
            </h3>
            <ul className="divide-y divide-[var(--border)]">
              {inGroup.map((tool) => (
                <li key={tool.slug}>
                  <label className="flex cursor-pointer items-start gap-3 px-5 py-3.5">
                    <input
                      type="checkbox"
                      name="tool"
                      value={tool.slug}
                      defaultChecked={tool.enabled}
                      className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{tool.name}</span>
                      <span className="muted block text-xs">{tool.about}</span>
                    </span>
                    <a
                      href={`/tools/${tool.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="muted ml-auto shrink-0"
                      aria-label={`${labels.view} ${tool.name}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon name="external" size={15} />
                    </a>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="flex items-center gap-3">
        <SubmitButton className="btn btn-primary">{labels.save}</SubmitButton>
        {state.ok && (
          <span className="flex items-center gap-1.5 text-sm text-[var(--success)]">
            <Icon name="check" size={15} />
            {labels.saved}
          </span>
        )}
        {state.error && (
          <span className="flex items-center gap-1.5 text-sm text-[var(--danger)]" role="alert">
            <Icon name="alert" size={15} />
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
