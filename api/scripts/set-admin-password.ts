/**
 * Set (or reset) an admin password: `npm run admin:password`
 *
 * The seed prints a generated password exactly once and stores only a bcrypt
 * hash, so a lost password is genuinely unrecoverable — and re-running the seed
 * will not help, because its upsert deliberately leaves an existing admin's
 * password alone rather than resetting a credential that may be in use.
 *
 * Usage — the script prompts for the password, so nothing secret is typed on a
 * command line where the shell would record it:
 *
 *   npm run admin:password
 *
 * It asks for the email too, defaulting to admin@sendy.ng. Both can be supplied
 * as ADMIN_EMAIL / ADMIN_PASSWORD for non-interactive use (CI, a container),
 * which skips the matching prompt.
 *
 * Prompting is deliberate rather than a convenience. The obvious shell recipes
 * are all subtly wrong: bash's `VAR=x cmd` is a parse error in PowerShell, and
 * PowerShell's `$env:ADMIN_PASSWORD = Read-Host "…"` silently consumes the NEXT
 * pasted line as its input when the block is pasted at once — so the command
 * that was supposed to use the password never runs, with no error to show for
 * it. Owning the prompt removes the whole category.
 *
 * Set DATABASE_URL to target a deployed database instead of .env. Note the
 * pooler URL needs ?pgbouncer=true, and that PowerShell parses & and ? out of a
 * bare string, so quote it.
 */
import 'dotenv/config';
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Matches the cost used by prisma/seed.ts — keep the two in step.
const BCRYPT_ROUNDS = 10;
const MIN_LENGTH = 12;
const DEFAULT_EMAIL = 'admin@sendy.ng';

/** Reads one line. `mask` suppresses the echo so a password never hits the screen. */
function ask(question: string, mask = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  if (mask) {
    // readline writes the prompt itself, then each keystroke. Swallow only the
    // keystrokes: the prompt still needs to be visible.
    const out = rl as unknown as { _writeToOutput: (s: string) => void };
    const write = out._writeToOutput.bind(rl);
    out._writeToOutput = (s: string) => write(s.includes(question) ? s : '');
  }

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      if (mask) process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const interactive = process.stdin.isTTY === true;

  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  if ((!email || !password) && !interactive) {
    console.error(
      '\n✗ ADMIN_EMAIL and ADMIN_PASSWORD must be set when there is no terminal to prompt on.\n'
    );
    process.exit(1);
  }

  if (!email) {
    email = (await ask(`Admin email [${DEFAULT_EMAIL}]: `)) || DEFAULT_EMAIL;
  }

  if (!password) {
    password = await ask('New password (hidden): ', true);

    /**
     * Nothing echoes while typing, so a typo is invisible and would otherwise
     * only surface as a failed login much later, with no way to tell a mistyped
     * password from a script that did not work.
     */
    const confirm = await ask('Confirm password: ', true);
    if (password !== confirm) {
      console.error('\n✗ Passwords do not match. Nothing was changed.\n');
      process.exit(1);
    }
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
