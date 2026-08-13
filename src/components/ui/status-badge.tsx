import { Icon, type IconName } from "@/components/icons";

const TONE: Record<string, { cls: string; icon: IconName }> = {
  pending: { cls: "badge-muted", icon: "clock" },
  processing: { cls: "badge-info", icon: "refresh" },
  inprogress: { cls: "badge-info", icon: "play" },
  completed: { cls: "badge-success", icon: "checkCircle" },
  partial: { cls: "badge-warning", icon: "alert" },
  canceled: { cls: "badge-danger", icon: "close" },
  refunded: { cls: "badge-warning", icon: "refresh" },
  failed: { cls: "badge-danger", icon: "alert" },
  open: { cls: "badge-info", icon: "ticket" },
  answered: { cls: "badge-success", icon: "send" },
  closed: { cls: "badge-muted", icon: "check" },
};

/**
 * Status never relies on colour alone — each state carries its own glyph and
 * its translated label.
 */
export default function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = TONE[status] ?? { cls: "badge-muted", icon: "info" as IconName };
  return (
    <span className={`badge ${tone.cls}`}>
      <Icon name={tone.icon} size={12} />
      {label}
    </span>
  );
}
