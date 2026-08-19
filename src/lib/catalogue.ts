import type { Prisma } from "@prisma/client";

/**
 * What "on sale" means, in one place.
 *
 * A service is on sale when it is switched on *and* its platform is still
 * selling. The second half is the platform-level switch on the features page:
 * an operator whose supplier has gone down for the night takes one platform
 * off sale rather than hiding it from the site or turning off forty services
 * one at a time.
 *
 * It lives here rather than being written out at each query because the two
 * halves have to agree everywhere. A surface that lists a service the order
 * path refuses is a customer filling in a form that cannot be submitted, and a
 * surface that hides one the API still sells is a switch that does nothing.
 */

/** A service that can be found and bought right now. */
export const ON_SALE = {
  enabled: true,
  category: { OR: [{ platformId: null }, { platform: { showServices: true } }] },
} satisfies Prisma.ServiceWhereInput;

/**
 * A platform worth putting in front of a customer who is about to order:
 * listed, still selling, and with something under it to sell.
 */
export const SELLING_PLATFORM = {
  visible: true,
  showServices: true,
} satisfies Prisma.PlatformWhereInput;
