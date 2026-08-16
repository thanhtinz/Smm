import type { Fault } from "./fault";

/**
 * What one account is allowed to do.
 *
 * Roles answer "is this person staff"; these answer "may this customer still
 * place orders". The two are separate on purpose. An operator dealing with a
 * customer who charges back every deposit wants to stop the deposits without
 * suspending the account — a suspension logs them out and hides the orders
 * they are arguing about, which makes the argument worse rather than shorter.
 *
 * Stored on the user as JSON of rule -> false, holding only the refusals.
 * Absence is permission, which is what makes adding a rule to this list safe:
 * nobody is retroactively barred from something that did not exist when their
 * row was written.
 */

export const ACCESS_RULES = [
  "order",
  "refill",
  "cancel",
  "deposit",
  "ticket",
  "api",
  "affiliate",
  "childPanel",
] as const;

export type AccessRule = (typeof ACCESS_RULES)[number];

/** Whether a rule name off a form or a JSON blob is one we know. */
export function isAccessRule(value: string): value is AccessRule {
  return (ACCESS_RULES as readonly string[]).includes(value);
}

/**
 * The refusals on an account.
 *
 * Anything unparseable reads as no refusals rather than as every refusal: a
 * corrupted column should not lock a paying customer out of the panel, and the
 * failure is visible in admin the moment anyone looks at their access rules.
 */
export function parseAccessRules(raw: string): Set<AccessRule> {
  const denied = new Set<AccessRule>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    return denied;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return denied;

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === false && isAccessRule(key)) denied.add(key);
  }
  return denied;
}

/** Back to the stored shape, holding only the refusals. */
export function serialiseAccessRules(denied: Iterable<AccessRule>): string {
  return JSON.stringify(Object.fromEntries([...denied].map((rule) => [rule, false])));
}

export function can(user: { accessRules: string } | null, rule: AccessRule): boolean {
  if (!user) return false;
  return !parseAccessRules(user.accessRules).has(rule);
}

/**
 * The refusal, in the shape the order paths already speak.
 *
 * Null when the account may proceed, so a caller reads as
 * `const denied = deny(user, "order"); if (denied) return …`, the same way it
 * already reads the abuse guards.
 */
export function deny(user: { accessRules: string } | null, rule: AccessRule): Fault | null {
  return can(user, rule) ? null : { key: `access.denied.${rule}` };
}

/**
 * Which payment methods an account may use.
 *
 * An empty list is every method. It has to be: the column was added to
 * accounts that already existed, and reading empty as "none" would have taken
 * the deposit page away from all of them at once.
 */
export function parseAllowedMethods(raw: string): Set<string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const ids = parsed.filter((x): x is string => typeof x === "string" && x !== "");
  return ids.length > 0 ? new Set(ids) : null;
}

export function methodAllowed(user: { allowedPaymentMethods: string } | null, methodId: string): boolean {
  if (!user) return false;
  const allowed = parseAllowedMethods(user.allowedPaymentMethods);
  return allowed === null || allowed.has(methodId);
}

/** Filters a list of methods down to the ones this account may use. */
export function allowedMethods<T extends { id: string }>(
  user: { allowedPaymentMethods: string } | null,
  methods: T[],
): T[] {
  const allowed = user ? parseAllowedMethods(user.allowedPaymentMethods) : new Set<string>();
  if (allowed === null) return methods;
  return methods.filter((m) => allowed.has(m.id));
}
