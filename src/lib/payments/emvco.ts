/**
 * The EMVCo merchant-QR primitives, shared by every scheme built on them.
 *
 * VietQR was the first, and its builder grew these two functions privately.
 * PromptPay, PayNow and QRIS are the same standard with a different merchant
 * block, so they live here rather than being copied three more times — a
 * second CRC implementation that disagrees with the first is a QR that scans
 * on one phone and not another.
 */

/** EMVCo TLV: two-digit tag, two-digit length, value. */
export function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE over the payload including the "6304" tag. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Closes a payload: appends the CRC tag and its value. */
export function seal(payload: string): string {
  const withTag = `${payload}6304`;
  return withTag + crc16(withTag);
}

export type Field = { tag: string; value: string };

/**
 * Reads a payload back into its fields.
 *
 * Needed because one scheme here does not build a QR from parts at all: a
 * merchant's QRIS code is issued by their acquirer and the panel's job is to
 * put an amount into the one they already have. Doing that by searching the
 * string for "54" would corrupt any code whose merchant id happens to contain
 * those digits, so it is parsed properly instead.
 *
 * Returns null for anything that is not a well-formed payload rather than
 * guessing at a repair.
 */
export function parse(payload: string): Field[] | null {
  const fields: Field[] = [];
  let i = 0;

  while (i < payload.length) {
    if (i + 4 > payload.length) return null;
    const tag = payload.slice(i, i + 2);
    const rawLength = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(rawLength)) return null;

    const length = Number(rawLength);
    const start = i + 4;
    const end = start + length;
    if (end > payload.length) return null;

    fields.push({ tag, value: payload.slice(start, end) });
    i = end;
  }

  return fields.length > 0 ? fields : null;
}

/** Whether a payload's own CRC agrees with its contents. */
export function checksumValid(payload: string): boolean {
  const at = payload.lastIndexOf("6304");
  if (at < 0 || at + 8 !== payload.length) return false;
  return crc16(payload.slice(0, at + 4)) === payload.slice(at + 4).toUpperCase();
}

/** Fields back into a payload, resealed. */
export function build(fields: Field[]): string {
  return seal(
    fields
      .filter((f) => f.tag !== "63")
      .map((f) => tlv(f.tag, f.value))
      .join(""),
  );
}
