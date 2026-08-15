import { Icon, type IconName } from "@/components/icons";

/**
 * The two cards beside the order form: what to know, and who to ask.
 *
 * Both are the operator's, not this file's. The notes come from one setting
 * and the channels from the branding settings the contact dock already reads,
 * so a panel that sells something this one has never heard of can still say
 * the right thing here, and neither card appears at all when the operator has
 * left it empty — an empty box reads as a panel that forgot, which is worse
 * than no box.
 */
export function OrderNotes({ notes, title }: { notes: string; title: string }) {
  // One note per line, "Heading | what it means". A line with no bar is a
  // note with no heading, which is the right shape for a single blunt warning.
  const items = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bar = line.indexOf("|");
      return bar === -1
        ? { heading: "", body: line }
        : { heading: line.slice(0, bar).trim(), body: line.slice(bar + 1).trim() };
    });

  if (items.length === 0) return null;

  return (
    <section className="card card-pad">
      <h3 className="flex items-center gap-2 font-semibold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning)]">
          <Icon name="alert" size={15} />
        </span>
        {title}
      </h3>

      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="surface-2 rounded-xl px-3.5 py-3 text-sm leading-relaxed">
            {item.heading && <span className="block font-semibold">{item.heading}</span>}
            <span className={`muted block ${item.heading ? "mt-0.5" : ""}`}>{item.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type SupportChannel = { href: string; name: string; handle: string; icon?: IconName; word?: string; tone: string };

/** The channels the operator filled in, as a card rather than a floating dock. */
export function OrderSupport({ settings, title }: { settings: Record<string, unknown>; title: string }) {
  const value = (key: string) => String(settings[key] ?? "").trim();
  const channels: SupportChannel[] = [];

  const telegram = value("site.telegram");
  if (telegram) {
    channels.push({
      href: /^https?:/i.test(telegram) ? telegram : `https://t.me/${telegram.replace(/^@/, "")}`,
      name: "Telegram",
      handle: telegram.replace(/^https?:\/\/t\.me\//i, "@"),
      icon: "telegram",
      tone: "#229ed9",
    });
  }

  const zalo = value("site.zalo");
  if (zalo) {
    channels.push({
      // Operators write either a bare number or a full link; both reach Zalo.
      href: /^https?:/i.test(zalo) ? zalo : `https://zalo.me/${zalo.replace(/[^\d]/g, "")}`,
      name: "Zalo",
      handle: zalo.replace(/^https?:\/\/zalo\.me\//i, ""),
      // Zalo has no glyph in the icon set, and inventing one would only look
      // like the Telegram plane again. The word is what people recognise.
      word: "Zalo",
      tone: "#0068ff",
    });
  }

  const facebook = value("site.facebook");
  if (facebook) {
    channels.push({
      href: /^https?:/i.test(facebook) ? facebook : `https://facebook.com/${facebook}`,
      name: "Fanpage",
      handle: "Messenger",
      icon: "facebook",
      tone: "#1877f2",
    });
  }

  if (channels.length === 0) return null;

  return (
    <section className="card card-pad">
      <h3 className="flex items-center gap-2 font-semibold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] text-[var(--primary)]">
          <Icon name="headset" size={15} />
        </span>
        {title}
      </h3>

      <div className="mt-3 grid gap-2">
        {channels.map((channel) => (
          <a
            key={channel.name}
            href={channel.href}
            target="_blank"
            rel="noopener noreferrer"
            className="surface-2 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 transition-colors hover:bg-[var(--surface2)]"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: `color-mix(in srgb, ${channel.tone} 16%, transparent)`, color: channel.tone }}
            >
              {channel.icon ? <Icon name={channel.icon} size={16} /> : channel.word}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{channel.name}</span>
              <span className="muted block truncate text-xs">{channel.handle}</span>
            </span>
            <Icon name="arrowRight" size={14} className="muted ml-auto shrink-0" />
          </a>
        ))}
      </div>
    </section>
  );
}
