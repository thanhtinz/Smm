import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { resolveCurrency, formatDigits } from "@/lib/currency";
import { prepareDeposit, cancelDepositAction, capturePaypalReturn } from "@/app/actions/wallet";
import { Icon } from "@/components/icons";
import StatusBadge from "@/components/ui/status-badge";
import CopyField from "@/components/ui/copy-field";

export const metadata: Metadata = { title: "Payment" };

export default async function DepositPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t } = ctx;

  // The payer is back from PayPal having approved the order, which moves no
  // money on its own — capture does, and this is where it happens. Before the
  // read below, so the page they land on already says "credited" rather than
  // showing a pending deposit that quietly completes a moment later.
  //
  // `token` is PayPal's own name for the order id on the return URL. A payer
  // who never comes back is covered by the webhook instead.
  if (query.paypal === "return") {
    const orderId = typeof query.token === "string" ? query.token : "";
    if (orderId) await capturePaypalReturn(id, orderId);
  }

  const txn = await db.transaction.findFirst({
    where: { id, userId: user.id, type: "deposit" },
    include: { method: true },
  });
  if (!txn) notFound();

  // In the transaction's own payment currency, not the reader's — this is the
  // page the customer copies the amount from, so "103.2" where the gateway
  // expects 103.20 is a transfer that comes back short.
  const paidIn = await resolveCurrency(txn.currency);
  const money = (n: number) => formatDigits(n, paidIn);

  if (txn.status === "completed") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card card-pad text-center">
          <span className="inline-flex text-[var(--success)]">
            <Icon name="checkCircle" size={40} />
          </span>
          <h2 className="mt-4 text-xl font-bold">{t("wallet.credited.title")}</h2>
          <p className="muted mt-2 text-sm">
            #{txn.publicId} · {money(txn.paidAmount)} {txn.currency}
          </p>
          <Link href="/dashboard" className="btn btn-primary btn-sm mt-6">
            <Icon name="dashboard" size={15} />
            {t("dash.title")}
          </Link>
        </div>
      </div>
    );
  }

  if (txn.status !== "pending") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card card-pad text-center">
          <StatusBadge status={txn.status} label={t(`status.${txn.status}`)} />
          <p className="muted mt-4 text-sm">
            #{txn.publicId} · {money(txn.paidAmount)} {txn.currency}
          </p>
          <Link href="/dashboard/wallet" className="btn btn-ghost btn-sm mt-6">
            <Icon name="wallet" size={15} />
            {t("dash.addFunds")}
          </Link>
        </div>
      </div>
    );
  }

  const instruction = await prepareDeposit(id);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t("wallet.pending")}</h2>
        <StatusBadge status="pending" label={t("status.pending")} />
      </div>

      <div className="card card-pad">
        <dl className="space-y-2.5 text-sm">
          <Row label={t("order.id")} value={`#${txn.publicId}`} />
          <Row label={t("wallet.method")} value={txn.method?.name ?? "—"} />
          <Row label={t("wallet.payable")} value={`${money(txn.paidAmount)} ${txn.currency}`} strong />
        </dl>
      </div>

      {instruction?.kind === "transfer" && (
        <div className="card card-pad space-y-5">
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
            {instruction.qrPayload && (
              <div className="mx-auto rounded-2xl bg-white p-3">
                <div
                  className="h-44 w-44"
                  // Generated locally from the VietQR payload, so the QR keeps
                  // working with no outbound request at render time.
                  dangerouslySetInnerHTML={{
                    __html: await QRCode.toString(instruction.qrPayload, {
                      type: "svg",
                      margin: 0,
                      width: 176,
                      errorCorrectionLevel: "M",
                    }),
                  }}
                />
                <p className="mt-2 text-center text-[0.7rem] font-medium text-black">{t("wallet.scan")}</p>
              </div>
            )}

            <div className="min-w-0 space-y-3">
              <CopyField label={t("wallet.bank")} value={instruction.bankName} copyLabel={t("wallet.copy")} copiedLabel={t("wallet.copied")} />
              <CopyField label={t("wallet.account")} value={instruction.accountNumber} copyLabel={t("wallet.copy")} copiedLabel={t("wallet.copied")} mono />
              <CopyField label={t("wallet.accountName")} value={instruction.accountName} copyLabel={t("wallet.copy")} copiedLabel={t("wallet.copied")} />
              <CopyField
                label={t("wallet.reference")}
                value={instruction.reference}
                copyLabel={t("wallet.copy")}
                copiedLabel={t("wallet.copied")}
                mono
                highlight
              />
            </div>
          </div>

          <div className="alert alert-info" role="note">
            <Icon name="info" size={16} />
            <span>{t("wallet.transferNote")}</span>
          </div>
        </div>
      )}

      {instruction?.kind === "manual" && (
        <div className="card card-pad space-y-4">
          <p className="text-sm leading-relaxed">{instruction.instructions}</p>
          <CopyField
            label={t("wallet.reference")}
            value={instruction.reference}
            copyLabel={t("wallet.copy")}
            copiedLabel={t("wallet.copied")}
            mono
            highlight
          />
        </div>
      )}

      {instruction?.kind === "redirect" && (
        <div className="card card-pad text-center">
          <a href={instruction.url} className="btn btn-primary btn-lg" rel="noopener noreferrer">
            <Icon name="external" size={17} />
            {t("wallet.openGateway")}
          </a>
        </div>
      )}

      {instruction?.kind === "unconfigured" && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{t(instruction.key)}</span>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Link href={`/dashboard/wallet/${id}`} className="btn btn-ghost btn-sm">
          <Icon name="refresh" size={15} />
          {t("wallet.checkAgain")}
        </Link>
        <form action={cancelDepositAction.bind(null, id)}>
          <button type="submit" className="btn btn-danger btn-sm">
            <Icon name="close" size={15} />
            {t("wallet.cancelDeposit")}
          </button>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <dt className="muted text-[0.82rem]">{label}</dt>
      <dd className={`tabular-nums sm:text-right ${strong ? "text-base font-bold" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
