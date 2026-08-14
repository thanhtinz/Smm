import Link from "next/link";
import { Icon } from "@/components/icons";

/**
 * Shown in place of the site while maintenance mode is on.
 *
 * The sign-in link stays: staff are let through, and this is where they come
 * back from. A layout cannot set a status code, so this is a 200 like the
 * suspended-panel page — the API is the one that answers 503.
 */
export default function MaintenanceNotice({
  site,
  message,
  signIn,
}: {
  site: string;
  message: string;
  signIn: string;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="card card-pad max-w-md space-y-3 text-center">
        <span
          className="muted mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--surface2)" }}
        >
          <Icon name="settings" size={22} />
        </span>
        <h1 className="text-lg font-semibold">{site}</h1>
        <p className="muted text-sm">{message}</p>
        <Link href="/login" className="btn btn-ghost btn-sm mx-auto">
          <Icon name="user" size={15} />
          {signIn}
        </Link>
      </div>
    </div>
  );
}
