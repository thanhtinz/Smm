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
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        >
          <Icon name={icon} size={19} />
        </span>
        {delta && <span className="badge badge-success">{delta}</span>}
      </div>
      <p className="muted mt-4 text-[0.7rem] font-semibold tracking-widest uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
