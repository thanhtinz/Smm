import { crc16, tlv } from "./emvco";

/**
 * VietQR payload builder (EMVCo Merchant Presented QR, NAPAS profile).
 *
 * Built locally rather than fetched from an image service so the QR keeps
 * working without an outbound request, and so the exact amount and transfer
 * reference we encode are the ones we later match in the webhook.
 */

/** Bank BIN codes used by NAPAS for VietQR. */
export const VIETQR_BANKS: Record<string, { bin: string; name: string }> = {
  MB: { bin: "970422", name: "MB Bank" },
  VCB: { bin: "970436", name: "Vietcombank" },
  TCB: { bin: "970407", name: "Techcombank" },
  ACB: { bin: "970416", name: "ACB" },
  VPB: { bin: "970432", name: "VPBank" },
  BIDV: { bin: "970418", name: "BIDV" },
  CTG: { bin: "970415", name: "VietinBank" },
  AGR: { bin: "970405", name: "Agribank" },
  TPB: { bin: "970423", name: "TPBank" },
  STB: { bin: "970403", name: "Sacombank" },
  HDB: { bin: "970437", name: "HDBank" },
  VIB: { bin: "970441", name: "VIB" },
  MSB: { bin: "970426", name: "MSB" },
  SHB: { bin: "970443", name: "SHB" },
  OCB: { bin: "970448", name: "OCB" },
  SEAB: { bin: "970440", name: "SeABank" },
  EIB: { bin: "970431", name: "Eximbank" },
  LPB: { bin: "970449", name: "LPBank" },
  NAB: { bin: "970428", name: "Nam A Bank" },
  PVCB: { bin: "970412", name: "PVcomBank" },
  ABB: { bin: "970425", name: "ABBANK" },
  BAB: { bin: "970409", name: "BacA Bank" },
  VAB: { bin: "970427", name: "VietABank" },
  VBB: { bin: "970433", name: "VietBank" },
  KLB: { bin: "970452", name: "KienlongBank" },
  NCB: { bin: "970419", name: "NCB" },
  PGB: { bin: "970430", name: "PGBank" },
  SGB: { bin: "970400", name: "SaigonBank" },
  BVB: { bin: "970438", name: "BaoVietBank" },
};

export type VietQrInput = {
  bankCode: string;
  accountNumber: string;
  /** Whole VND. Omit for a QR the payer types the amount into. */
  amount?: number;
  /** Transfer reference — this is what the webhook matches on. */
  description?: string;
};

export function buildVietQrPayload({ bankCode, accountNumber, amount, description }: VietQrInput): string {
  const bank = VIETQR_BANKS[bankCode.toUpperCase()];
  if (!bank) throw new Error(`Unknown bank code: ${bankCode}`);

  const merchantAccount = tlv("00", "A000000727") + tlv("01", tlv("00", bank.bin) + tlv("01", accountNumber)) + tlv("02", "QRIBFTTA");

  let payload =
    tlv("00", "01") +
    // 11 = static, 12 = one-time. An amount-bearing QR is one-time.
    tlv("01", amount ? "12" : "11") +
    tlv("38", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "704") +
    (amount ? tlv("54", String(Math.round(amount))) : "") +
    tlv("58", "VN");

  if (description) payload += tlv("62", tlv("08", sanitise(description)));

  payload += "6304";
  return payload + crc16(payload);
}

/** VietQR references are ASCII-only and capped at 25 characters. */
export function sanitise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, 25);
}
