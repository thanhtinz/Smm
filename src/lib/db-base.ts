import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The unscoped client.
 *
 * Nothing outside `src/lib/tenancy.ts` and `src/lib/db.ts` should import this:
 * it has no panel filter, so a query written against it reaches every panel.
 * Tenancy resolution itself has to use it, because the panel lookup is what
 * the filter depends on.
 */
export const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;
