import { Icon, type IconName } from "@/components/icons";

export type PlatformLike = { name: string; icon: string; image?: string; color: string };

/**
 * A platform's badge.
 *
 * An image wins over the bundled SVG glyph, so a panel shows the real brand
 * mark in its own colours. The glyph is the fallback for a platform an
 * operator added themselves and has not given artwork to.
 *
 * The tinted tile goes with the glyph. It exists to give a one-colour outline
 * a ground to sit on; a brand mark already carries its own — YouTube's red
 * rectangle on a pink square, X's black square on a grey one — and the tile
 * behind it reads as a badge inside a badge.
 */
export default function PlatformMark({
  platform,
  size = 18,
  box,
  plain,
}: {
  platform: PlatformLike;
  /** Glyph size; the image is fitted to the same optical weight. */
  size?: number;
  /** Rounded tile size. Omit for a bare glyph. */
  box?: number;
  /** Skip the tinted tile background. */
  plain?: boolean;
}) {
  const content = platform.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={platform.image}
      alt=""
      width={size}
      height={size}
      className="object-contain"
      style={{ width: box ? Math.round(box * 0.82) : size, height: box ? Math.round(box * 0.82) : size }}
      loading="lazy"
    />
  ) : (
    <Icon name={platform.icon as IconName} size={size} />
  );

  if (!box) {
    return <span style={{ color: platform.image ? undefined : platform.color }}>{content}</span>;
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{
        width: box,
        height: box,
        background: plain || platform.image ? undefined : `${platform.color}22`,
        color: platform.color,
      }}
    >
      {content}
    </span>
  );
}
