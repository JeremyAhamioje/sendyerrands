/**
 * Set (or reset) an admin password: `npm run admin:password`
 *
 * The seed prints a generated password exactly once and stores only a bcrypt
 * hash, so a lost password is genuinely unrecoverable — and re-running the seed
 * will not help, because its upsert deliberately leaves an existing admin's
 * password alone rather than resetting a credential that may be in use.
 *
 * Credentials come from the environment, never from argv: command-line
 * arguments land in shell history and in the process list, where any other user
 * on the machine can read them.
 *
 *   ADMIN_EMAIL=admin@sendy.ng ADMIN_PASSWORD='...' npm run admin:password
 *
 * Add DATABASE_URL inline to target a deployed database instead of .env:
 *
 *   DATABASE_URL='postgresql://…pooler…:6543/postgres?pgbouncer=true' \
 *     ADMIN_EMAIL=admin@sendy.ng ADMIN_PASSWORD='...' npm run admin:password
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Matches the cost used by prisma/seed.ts — keep the two in step.
const BCRYPT_ROUNDS = 10;
const MIN_LENGTH = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      '\n✗ Both ADMIN_EMAIL and ADMIN_PASSWORD must be set.\n\n' +
        "  ADMIN_EMAIL=admin@sendy.ng ADMIN_PASSWORD='…' npm run admin:password\n"
    );
    process.exit(1);
  }

  /**
   * This account can refund money and reassign riders, and the dashboard is on
   * a public URL. A short password is the whole security boundary, so refuse
   * one rather than warn about it.
   */
  if (password.length < MIN_LENGTH) {
    console.error(`\n✗ Password must be at least ${MIN_LENGTH} characters.\n`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const host = new URL(process.env.DATABASE_URL ?? 'postgresql://unknown').hostname;
    const existing = await prisma.admin.findUnique({ where: { email } });

    if (!existing) {
      const known = await prisma.admin.findMany({ select: { email: true } });
      console.error(`\n✗ No admin with email ${email} on ${host}.`);
      console.error(
        known.length
          ? `  Existing admins: ${known.map((a) => a.email).join(', ')}\n`
          : '  There are no admin accounts at all — run `npm run seed` first.\n'
      );
      process.exit(1);
    }

    await prisma.admin.update({
      where: { email },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    });

    // The password itself is never echoed — it is already in the caller's hands.
    console.log(`\n✓ Password updated for ${email} on ${host}.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
