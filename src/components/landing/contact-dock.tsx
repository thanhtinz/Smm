import { Icon, type IconName } from "@/components/icons";

/**
 * The floating contact buttons.
 *
 * Every panel in this market has these, and Zalo leads because that is where
 * the conversation actually happens here. Only channels the operator filled
 * in are rendered — an empty dock rather than dead buttons.
 */
export default function ContactDock({
  settings,
  labels,
}: {
  settings: Record<string, unknown>;
  labels: { zalo: string; telegram: string };
}) {
  const zalo = String(settings["site.zalo"] ?? "").trim();
  const telegram = String(settings["site.telegram"] ?? "").trim();

  // Zalo has no glyph in the icon set and inventing one would just look like
  // the Telegram paper plane again, so it wears its name. The word is what
  // people here recognise anyway.
  const links: { href: string; label: string; icon?: IconName; word?: string; tone: string }[] = [];

  // Operators write either a bare number or a full link; both reach Zalo.
  if (zalo) {
    links.push({
      href: /^https?:/i.test(zalo) ? zalo : `https://zalo.me/${zalo.replace(/[^\d]/g, "")}`,
      label: labels.zalo,
      word: "Zalo",
      tone: "#0068ff",
    });
  }
  if (telegram) {
    links.push({
      href: /^https?:/i.test(telegram) ? telegram : `https://t.me/${telegram.replace(/^@/, "")}`,
      label: labels.telegram,
      icon: "telegram",
      tone: "#229ed9",
    });
  }

  if (!links.length) return null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col gap-2.5 print:hidden">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          title={l.label}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
          style={{ background: l.tone }}
        >
          {l.icon ? <Icon name={l.icon} size={21} /> : <span className="text-sm font-bold">{l.word}</span>}
          <span className="sr-only">{l.label}</span>
        </a>
      ))}
    </div>
  );
}
