import PlatformMark from "@/components/platform-mark";
import type { PlatformLine } from "@/lib/landing";

/**
 * The platforms, as the picture.
 *
 * What stood here was a drawn phone with a squiggle climbing it and the marks
 * orbiting on a dotted ring — a placeholder from before there were real brand
 * marks to place. Once there were, it read as logos pasted onto a doodle, and
 * the row of the same seven logos underneath said everything twice.
 *
 * So the marks are the composition. Three columns, the outer two dropped half
 * a step, which is what stops a grid of logos reading as a spreadsheet. Sizes
 * vary by column rather than at random: a column of one size and its
 * neighbour of another is a rhythm; eight different sizes is noise.
 *
 * It is the fallback for an operator who has not uploaded a photograph, and
 * the better one — a panel's platforms are the thing worth showing, and this
 * one is current the moment the catalogue changes.
 */
export default function PlatformCluster({ platforms }: { platforms: PlatformLine[] }) {
  // Nine fills three even columns; fewer simply makes shorter ones.
  const marks = platforms.slice(0, 9);
  if (marks.length === 0) return null;

  const columns = [0, 1, 2].map((c) => marks.filter((_, i) => i % 3 === c));

  return (
    <div className="mx-auto flex w-full max-w-[26rem] items-start justify-center gap-4 sm:gap-5">
      {columns.map((column, c) => (
        <div
          key={c}
          className={`flex flex-1 flex-col gap-4 sm:gap-5 ${c === 1 ? "" : "mt-8 sm:mt-10"}`}
        >
          {column.map((platform) => (
            <div
              key={platform.id}
              className="flex aspect-square items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
            >
              <PlatformMark platform={platform} size={c === 1 ? 46 : 38} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
