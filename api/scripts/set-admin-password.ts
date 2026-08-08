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
 * PowerShell — prompt for the password rather than typing it on the command
 * line, which PSReadLine would write to ConsoleHost_history.txt on disk:
 *
 *   $env:ADMIN_EMAIL = "admin@sendy.ng"
 *   $env:ADMIN_PASSWORD = Read-Host "New admin password"
 *   npm run admin:password
 *   Remove-Item Env:ADMIN_PASSWORD
 *
 * bash / zsh — a leading space keeps the line out of history when HISTCONTROL
 * includes ignorespace:
 *
 *    ADMIN_EMAIL=admin@sendy.ng ADMIN_PASSWORD='…' npm run admin:password
 *
 * Set DATABASE_URL the same way to target a deployed database instead of .env.
 * Note that the pooler URL needs ?pgbouncer=true, and that quoting matters in
 * PowerShell because & and ? are parsed from a bare string.
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
    // Shown for the shell actually in use — the syntax is not portable, and a
    // bash example on PowerShell reads as "not recognized as the name of a
    // cmdlet", which says nothing about what to do instead.
    const example =
      process.platform === 'win32'
        ? '  $env:ADMIN_EMAIL = "admin@sendy.ng"\n' +
          '  $env:ADMIN_PASSWORD = Read-Host "New admin password"\n' +
          '  npm run admin:password\n' +
          '  Remove-Item Env:ADMIN_PASSWORD\n'
        : "  ADMIN_EMAIL=admin@sendy.ng ADMIN_PASSWORD='…' npm run admin:password\n";

    console.error(`\n✗ Both ADMIN_EMAIL and ADMIN_PASSWORD must be set.\n\n${example}`);
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
