import { PrismaClient } from '@prisma/client';

import { env } from '@/config/env';

// Reuse one client across hot reloads in dev, or tsx watch exhausts the pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProd ? ['error'] : ['warn', 'error'],

    /**
     * Prisma's default interactive-transaction timeout is 5s, which assumes a
     * database on the same continent. Ours is a hosted Postgres reached over the
     * public internet, where a round-trip is ~0.5–1s — and checkout runs five
     * sequential statements (balance check, debit, ledger row, payment row,
     * status transition + audit event). That blows 5s and rolls back a payment
     * that would otherwise have succeeded.
     *
     * These are ceilings, not delays: a fast transaction still commits fast.
     *   maxWait — how long to queue for a connection before giving up
     *   timeout — how long the transaction body may run
     */
    transactionOptions: {
      maxWait: 10_000,
      timeout: 30_000,
    },
  });

if (!env.isProd) globalForPrisma.prisma = prisma;
