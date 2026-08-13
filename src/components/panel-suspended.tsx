import { Icon } from "@/components/icons";

/**
 * Shown instead of a suspended panel's pages.
 *
 * Not a 404: the panel exists and its owner needs to know why it stopped
 * trading. A layout cannot set a status code, so this stays a 200 for now.
 */
export default function PanelSuspended({ name, note }: { name: string; note: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="card card-pad max-w-md space-y-3 text-center">
        <span className="muted mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--surface2)" }}>
          <Icon name="alert" size={22} />
        </span>
        <h1 className="text-lg font-semibold">{name} is temporarily unavailable</h1>
        {note && <p className="muted text-sm">{note}</p>}
      </div>
    </div>
  );
}
