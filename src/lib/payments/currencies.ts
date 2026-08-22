/**
 * Which currencies a payment method may actually offer.
 *
 * Three lists meet here and none of them alone is the answer:
 *
 *  - what the **rail can physically move**. SePay, MoMo and PayOS speak to
 *    domestic Vietnamese rails whose APIs take a whole number of dong; ticking
 *    USD onto one means a $10.50 deposit asks the gateway for 11 of something.
 *    That is a fact about the rail, not a setting, so it stays in the driver.
 *  - what the **operator ticked**, in admin.
 *  - what the **panel actually has**, which is the currencies created on the
 *    currencies page.
 *
 * The last one was missing, and the seed made the gap visible: PayNow shipped
 * with SGD, a panel does not have SGD unless somebody created it, and the
 * method went on offering a currency nothing could price. Everything here is
 * an intersection, so a currency that has not been created cannot be offered,
 * cannot be saved, and cannot be quietly restored by a fallback.
 */

/**
 * What to offer, given all three lists.
 *
 * `panel` is authoritative: nothing outside it survives, whoever put it there.
 * An empty `chosen` means "the operator ticked nothing", which reads as "all
 * of them" everywhere else in the panel — so it expands to whatever the rail
 * and the panel agree on rather than to nothing.
 */
export function usableCurrencies(args: {
  /** The rail's own limit, or undefined when it has none. */
  rail?: readonly string[];
  /** What the operator ticked, from the stored row. */
  chosen: readonly string[];
  /** Codes the panel has created and enabled. */
  panel: readonly string[];
}): string[] {
  const panel = new Set(args.panel.map(up));
  const rail = args.rail ? new Set(args.rail.map(up)) : null;

  const offerable = [...panel].filter((code) => !rail || rail.has(code));
  const chosen = args.chosen.map(up).filter((code) => offerable.includes(code));

  return chosen.length > 0 ? chosen : offerable;
}

/**
 * What an operator may tick in admin: the rail's limit, narrowed to what the
 * panel has. Ordered by the panel's own list so the boxes read in the order
 * the currencies page shows them.
 */
export function offerableCurrencies(rail: readonly string[] | undefined, panel: readonly string[]): string[] {
  if (!rail) return panel.map(up);
  const allowed = new Set(rail.map(up));
  return panel.map(up).filter((code) => allowed.has(code));
}

/**
 * The currencies a rail could take that this panel has not created.
 *
 * Shown to the operator so "no currencies to tick" is a sentence naming what
 * to go and create, rather than an empty box.
 */
export function missingCurrencies(rail: readonly string[] | undefined, panel: readonly string[]): string[] {
  if (!rail) return [];
  const have = new Set(panel.map(up));
  return rail.map(up).filter((code) => !have.has(code));
}

function up(code: string): string {
  return code.trim().toUpperCase();
}
