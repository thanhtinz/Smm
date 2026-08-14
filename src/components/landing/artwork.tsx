import PlatformMark from "@/components/platform-mark";
import type { PlatformLine } from "@/lib/landing";

/**
 * The hero illustration.
 *
 * Drawn here rather than uploaded, so a fresh panel is not an empty rectangle
 * and an operator who never opens a design tool still gets a home page with
 * something on it. Everything is SVG and CSS in the theme's own tokens, which
 * is the only way one drawing survives five skins in light and dark.
 *
 * The subject is the thing being sold: a post gaining engagement. A phone
 * frame, a counter climbing, and the platforms this panel actually carries
 * orbiting it — so the drawing changes when the catalogue does instead of
 * being a stock picture of somebody else's shop.
 */
export default function Artwork({ platforms }: { platforms: PlatformLine[] }) {
  // Six is what fits the ring without the marks colliding; the catalogue is
  // already ordered by the operator, so this takes their first six.
  const ring = platforms.slice(0, 6);
  const radius = 132;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
      {/* Glow behind everything, in the theme's primary. */}
      <div
        aria-hidden
        className="absolute inset-[12%] rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
      />

      <svg viewBox="0 0 360 360" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="art-screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--surface2)" />
            <stop offset="100%" stopColor="var(--surface)" />
          </linearGradient>
          <linearGradient id="art-line" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>

        {/* Orbit the platform marks sit on. */}
        <circle
          cx="180"
          cy="180"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="3 7"
        />

        {/* Phone. */}
        <rect x="122" y="66" width="116" height="228" rx="26" fill="url(#art-screen)" stroke="var(--border)" />
        <rect x="132" y="76" width="96" height="208" rx="18" fill="var(--bg)" />

        {/* The climb. Not a real series — it is the drawing's subject, the
            same way a phone outline is, and it carries no number. */}
        <path
          d="M144 246 L164 224 L184 232 L204 196 L216 174"
          fill="none"
          stroke="url(#art-line)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="216" cy="174" r="5" fill="var(--accent)" />

        {/* Post placeholder above it. */}
        <rect x="144" y="94" width="72" height="52" rx="8" fill="var(--surface2)" />
        <rect x="144" y="156" width="72" height="7" rx="3.5" fill="var(--border)" />
        <rect x="144" y="171" width="48" height="7" rx="3.5" fill="var(--border)" />
      </svg>

      {/* The marks are components, not paths, so an operator who uploaded
          real brand artwork for a platform sees it here too. */}
      {ring.map((p, i) => {
        const angle = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <span
            key={p.id}
            className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
            style={{
              marginLeft: `${Math.cos(angle) * radius}px`,
              marginTop: `${Math.sin(angle) * radius}px`,
            }}
          >
            <PlatformMark platform={p} size={22} />
          </span>
        );
      })}

    </div>
  );
}
