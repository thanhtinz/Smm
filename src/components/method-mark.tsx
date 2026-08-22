import PlatformMark from "@/components/platform-mark";

export type MethodLike = { name: string; icon: string; image?: string; color?: string };

/**
 * A payment method's badge.
 *
 * The same rule as a platform's: an uploaded logo wins, and the bundled glyph
 * tinted with the gateway's own colour is the fallback. A brand's colour is a
 * fact about it, so every method looks like itself the moment it is seeded —
 * before anybody has uploaded anything.
 */
export default function MethodMark({ method, size = 19, box }: { method: MethodLike; size?: number; box?: number }) {
  return (
    <PlatformMark
      platform={{ name: method.name, icon: method.icon, image: method.image, color: method.color || "#6366f1" }}
      size={size}
      box={box}
    />
  );
}
