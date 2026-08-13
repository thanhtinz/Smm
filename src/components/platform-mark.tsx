import { Icon, type IconName } from "@/components/icons";

export type PlatformLike = { name: string; icon: string; image?: string; color: string };

/**
 * A platform's badge. An uploaded image wins over the bundled SVG glyph, so
 * an operator can use real brand artwork without touching the icon set.
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
      style={{ width: size, height: size }}
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
        background: plain ? undefined : `${platform.color}22`,
        color: platform.color,
      }}
    >
      {content}
    </span>
  );
}
