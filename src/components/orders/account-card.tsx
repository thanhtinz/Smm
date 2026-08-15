import Link from "next/link";
import { Icon } from "@/components/icons";

export type AccountFacts = {
  name: string;
  balance: number;
  deposited: number;
  tierName: string;
  tierColor: string;
  discountPercent: number;
};

/**
 * Who is buying, and what they have to buy with.
 *
 * The balance is already in the top bar, so repeating it needs a reason: the
 * reason is that this is the column the customer reads while deciding, and
 * "can I afford this" is answered next to the price rather than at the far
 * corner of the screen. The tier sits here for the same reason — a discount
 * nobody can see is a discount that persuades nobody.
 */
export default function AccountCard({
  account,
  money,
  labels,
}: {
  account: AccountFacts;
  /** Pre-formatted, so currency conversion stays on the server. */
  money: { balance: string; deposited: string };
  labels: Record<string, string>;
}) {
  const initials = account.name.slice(0, 2).toUpperCase();

  return (
    <div className="card card-pad">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-sm font-bold text-[var(--primary)]">
          {initials}
        </span>
        <p className="min-w-0 truncate font-semibold">{account.name}</p>
      </div>

      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="muted flex items-center gap-1.5">
            <Icon name="wallet" size={14} />
            {labels.balance}
          </dt>
          <dd className="font-mono font-bold tabular-nums text-[var(--primary)]">{money.balance}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="muted flex items-center gap-1.5">
            <Icon name="bank" size={14} />
            {labels.deposited}
          </dt>
          <dd className="font-mono tabular-nums">{money.deposited}</dd>
        </div>
        {account.tierName && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="muted flex items-center gap-1.5">
              <Icon name="trending" size={14} />
              {labels.tier}
            </dt>
            <dd className="flex items-center gap-1.5">
              <span
                className="rounded-md px-2 py-0.5 text-xs font-semibold"
                style={{
                  background: `color-mix(in srgb, ${account.tierColor} 18%, transparent)`,
                  color: account.tierColor,
                }}
              >
                {account.tierName}
              </span>
              {account.discountPercent > 0 && (
                <span className="badge badge-success text-xs">−{account.discountPercent}%</span>
              )}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/dashboard/wallet" className="btn btn-primary btn-sm">
          <Icon name="plus" size={15} />
          {labels.addFunds}
        </Link>
        <Link href="/dashboard/profile" className="btn btn-ghost btn-sm">
          <Icon name="user" size={15} />
          {labels.account}
        </Link>
      </div>
    </div>
  );
}
