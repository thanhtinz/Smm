import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/context";
import { Icon } from "@/components/icons";
import { TOOL_GROUPS, enabledTools } from "@/lib/tools";

export const metadata: Metadata = { title: "Tools" };

export default async function ToolsPage() {
  const { t, settings } = await getAppContext();
  // Switched off means the address does not exist, not that it renders a
  // notice — an operator who closed the hub does not want it in search results.
  if (settings["tools.enabled"] === false) notFound();

  const tools = enabledTools(settings["tools.disabled"]);

  return (
    <div className="container-page py-14">
      <div className="max-w-2xl">
        <h1 className="text-[2.2rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-5xl">
          {t("tools.title")}
        </h1>
        <p className="muted mt-4 text-lg leading-relaxed">{t("tools.sub")}</p>
      </div>

      <div className="mt-12 space-y-12">
        {TOOL_GROUPS.map((group) => {
          const inGroup = tools.filter((tool) => tool.group === group);
          if (!inGroup.length) return null;

          return (
            <section key={group}>
              <h2 className="muted border-b border-[var(--border)] pb-2 text-xs font-semibold tracking-[0.18em] uppercase">
                {t(`tools.group.${group}`)}
              </h2>

              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inGroup.map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="card group flex h-full flex-col p-5 transition-colors hover:border-[color-mix(in_srgb,var(--primary)_45%,transparent)]"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-[var(--primary)]">
                        <Icon name={tool.icon} size={20} />
                      </span>
                      <h3 className="mt-4 font-semibold">{t(`tool.${tool.slug}.name`)}</h3>
                      <p className="muted mt-1.5 flex-1 text-sm leading-relaxed">{t(`tool.${tool.slug}.about`)}</p>
                      <span className="muted mt-4 flex items-center gap-1.5 text-sm transition-transform group-hover:translate-x-1">
                        <Icon name="arrowRight" size={15} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
