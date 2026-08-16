/**
 * Rounding, in the smallest unit the panel's base currency actually has.
 *
 * Every stored amount is a number in the base currency, and every one of them
 * used to be rounded with a bare `Math.round` — correct, invisibly, for as
 * long as the base was the dong, which has no subunit. On a panel based in
 * dollars the same call rounds to the nearest dollar: a $4.25 order charges
 * $4, a 5% commission on $12.30 pays $1, and a partial refund loses its
 * cents. None of it shows up as an error; the numbers are just quietly wrong,
 * in the panel's favour or the customer's depending on the digit.
 *
 * So the precision is a parameter with no default. Every caller has to say
 * what currency it is counting in, which is the only version of this that
 * cannot silently go back to whole units the next time someone adds a price.
 */
export function roundMoney(amount: number, decimals: number): number {
  const factor = 10 ** Math.max(0, Math.min(6, Math.trunc(decimals)));
  // The extra epsilon nudge is the classic float guard: 1.005 is stored as
  // 1.00499999999999989, so a naive round gives 1.00 where a person doing
  // this on paper gets 1.01.
  return Math.round((amount + Number.EPSILON * Math.sign(amount) * Math.abs(amount)) * factor) / factor;
}

/** The same, rounding down — for anything the panel pays out. */
export function floorMoney(amount: number, decimals: number): number {
  const factor = 10 ** Math.max(0, Math.min(6, Math.trunc(decimals)));
  return Math.floor(amount * factor) / factor;
}
