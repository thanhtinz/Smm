import Link from "next/link";
import PlatformMark from "@/components/platform-mark";
import { Icon } from "@/components/icons";
import type { FrequentService } from "@/lib/reorder";

/**
 * The shortcut for a customer who buys the same few things.
 *
 * Each card is a whole order started: the service is chosen, the cascade is
 * filled in behind it, and only the link and the number are left. The count
 * is on the card because it is the reason the card is there — it says "this
 * is yours", not "this is popular".
 */
export default function FrequentServices({
  services,
  prices,
  labels,
}: {
  services: FrequentService[];
  /** Pre-formatted per 1,000, so currency conversion stays on the server. */
  prices: Record<string, string>;
  labels: { title: string; times: string; per: string };
}) {
  if (services.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 font-semibold">{labels.title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/dashboard/new-order?service=${service.publicId}`}
            className="card flex min-w-0 flex-col gap-3 px-4 py-4 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2.5">
              {service.platform && <PlatformMark platform={service.platform} size={17} box={32} />}
              <span className="muted text-xs">
                {labels.times.replace("{n}", String(service.times))}
              </span>
            </div>
            <p className="line-clamp-2 min-w-0 text-sm leading-snug font-medium">{service.name}</p>
            <p className="muted mt-auto flex items-center gap-1.5 text-xs">
              <span className="font-mono font-semibold tabular-nums text-[var(--text)]">{prices[service.id]}</span>
              {labels.per}
              <Icon name="arrowRight" size={13} className="ms-auto" />
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
