import { Icon, type IconName } from "@/components/icons";

export default function StatCard({
  label,
  value,
  icon,
  tone = "primary",
  delta,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: "primary" | "accent" | "success" | "warning" | "danger";
  delta?: string;
}) {
  const color = `var(--${tone === "primary" ? "primary" : tone})`;
  return (
    <div className="card p-4 sm:px-5 sm:py-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        >
          <Icon name={icon} size={19} />
        </span>
        {delta && <span className="badge badge-success">{delta}</span>}
      </div>
      <p className="muted mt-3 text-[0.62rem] font-semibold tracking-widest uppercase sm:mt-4 sm:text-[0.7rem]">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight tabular-nums sm:text-2xl">{value}</p>
    </div>
  );
}
