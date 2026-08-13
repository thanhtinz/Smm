/**
 * A daily trend, drawn as inline SVG.
 *
 * No charting library: one series of at most a few hundred points does not
 * need one, and the panel already ships every other graphic as inline SVG.
 * The path is built server-side, so nothing renders twice or shifts on load.
 */

export type TrendPoint = { day: string; value: number };

export default function TrendChart({
  points,
  label,
  format,
  tone = "var(--primary)",
}: {
  points: TrendPoint[];
  label: string;
  /** Pre-formatted values, so currency and locale stay with the caller. */
  format: (value: number) => string;
  tone?: string;
}) {
  const width = 720;
  const height = 180;
  const pad = { top: 12, right: 4, bottom: 20, left: 4 };

  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? (width - pad.left - pad.right) / (points.length - 1) : 0;
  const y = (value: number) => pad.top + (1 - value / max) * (height - pad.top - pad.bottom);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${(pad.left + i * stepX).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = points.length
    ? `${line} L${(pad.left + (points.length - 1) * stepX).toFixed(1)},${height - pad.bottom} L${pad.left},${height - pad.bottom} Z`
    : "";

  const total = points.reduce((n, p) => n + p.value, 0);
  const gradientId = `trend-${label.replace(/\W+/g, "")}`;

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="muted text-xs tracking-wide uppercase">{label}</span>
        <span className="text-lg font-bold tabular-nums">{format(total)}</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${label}: ${format(total)}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.35" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>

        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && <path d={line} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}

        {/* A baseline so an all-zero stretch still reads as a chart. */}
        <line
          x1={pad.left}
          y1={height - pad.bottom}
          x2={width - pad.right}
          y2={height - pad.bottom}
          stroke="var(--border)"
          strokeWidth="1"
        />
      </svg>

      <div className="muted mt-1 flex justify-between text-[0.7rem] tabular-nums">
        <span>{points[0]?.day}</span>
        <span>{points[points.length - 1]?.day}</span>
      </div>
    </div>
  );
}
