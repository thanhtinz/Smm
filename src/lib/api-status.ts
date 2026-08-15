/**
 * The title-case status names the reseller API standard uses.
 *
 * Its own module, small as it is, because both the things that need it sit on
 * opposite sides of a boundary: the API route and the callback queue, and the
 * queue is reached from `orders.ts`, which client components import. Anything
 * those two shared through a bigger module would drag that module's server-only
 * imports into the browser bundle.
 */
const API_STATUS: Record<string, string> = {
  // Held is reported as Pending: the standard has no word for it, a reseller
  // can do nothing about it, and inventing one would break client code that
  // switches on this string.
  held: "Pending",
  pending: "Pending",
  processing: "Processing",
  inprogress: "In progress",
  completed: "Completed",
  partial: "Partial",
  canceled: "Canceled",
  refunded: "Refunded",
};

export function apiStatus(status: string): string {
  return API_STATUS[status] ?? status;
}
