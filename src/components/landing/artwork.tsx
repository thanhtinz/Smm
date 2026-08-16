import PlatformMark from "@/components/platform-mark";
import type { PlatformLine } from "@/lib/landing";

/**
 * The hero illustration: the platforms, arranged as a climb.
 *
 * What stood here was a drawn phone with a squiggle running up it and six
 * logos orbiting on a dotted ring, each in a white rounded tile. It was made
 * before there were real brand marks to place, and once there were it read as
 * a doodle with logos stuck on — a badge drawn around a badge, eight times,
 * beside a phone nobody was looking at.
 *
 * The marks are the drawing now, and the arrangement carries the same idea
 * the squiggle was gesturing at. Platforms are ordered by how many services
 * this panel actually carries and climb left to right, growing as they go, so
 * the shape is the catalogue rather than a decoration next to it: the
 * platform at the top right is the one the operator sells most on, and it
 * changes when they add services instead of staying a picture of nothing.
 *
 * No tiles under them. Every one of these marks arrives with its own ground —
 * YouTube's red rectangle, Instagram's gradient square, the black square
 * behind Threads and X — so a card behind it adds a second frame and takes
 * the size the mark should have had.
 */
export default function Artwork({ platforms }: { platforms: PlatformLine[] }) {
  // Eight is where the marks stop having room to grow between steps; beyond
  // that the climb flattens into a row.
  const climb = [...platforms]
    .sort((a, b) => a.services - b.services || a.name.localeCompare(b.name))
    .slice(-8);

  if (climb.length === 0) return null;

  // Position and size from the step alone, so the server and the browser draw
  // the same picture. A single platform sits in the middle at full size
  // rather than at the start of a climb it cannot make.
  const last = Math.max(1, climb.length - 1);
  const at = (i: number) => {
    const step = climb.length === 1 ? 0.5 : i / last;
    return {
      x: 8 + step * 82,
      // Eased rather than linear: a straight diagonal of logos reads as a
      // list set on a slant, a curve reads as a climb.
      y: 86 - Math.pow(step, 1.5) * 74,
      size: Math.round(38 + step * 38),
    };
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
      {/* Warmth behind the top of the climb, where the eye ends up. */}
      <div
        aria-hidden
        className="absolute inset-[14%] rounded-full blur-3xl"
        style={{ background: "color-mix(in srgb, var(--primary) 26%, transparent)" }}
      />

      {climb.length > 1 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="art-climb" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          {/* Drawn through the centres, so the line is the arrangement rather
              than a second shape laid over it. vectorEffect keeps it one
              hairline after the viewBox is stretched to the box. */}
          <polyline
            points={climb.map((_, i) => `${at(i).x},${at(i).y}`).join(" ")}
            fill="none"
            stroke="url(#art-climb)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {climb.map((platform, i) => {
        const { x, y, size } = at(i);
        return (
          <span
            key={platform.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <PlatformMark platform={platform} size={size} />
          </span>
        );
      })}
    </div>
  );
}
