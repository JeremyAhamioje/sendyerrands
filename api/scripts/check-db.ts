/**
 * Connection smoke test: `npm run db:check`
 *
 * Run this before `prisma migrate` so a bad URL fails here with a readable
 * message instead of a Prisma stack trace.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function describe(label: string, url: string | undefined) {
  if (!url) return `${label}: (not set)`;
  if (url.includes('[YOUR-PASSWORD]') || url.includes('[PROJECT-REF]')) {
    return `${label}: still has placeholders — paste your real connection string`;
  }
  try {
    const u = new URL(url);
    return `${label}: ${u.hostname}:${u.port || '5432'} (user ${u.username})`;
  } catch {
    return `${label}: malformed URL`;
  }
}

async function main() {
  console.log('\nChecking database configuration…\n');
  console.log('  ' + describe('DATABASE_URL', process.env.DATABASE_URL));
  console.log('  ' + describe('DIRECT_URL', process.env.DIRECT_URL));
  console.log('');

  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set.');
  if (!process.env.DIRECT_URL) problems.push('DIRECT_URL is not set.');
  for (const [name, url] of Object.entries({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  })) {
    if (url?.includes('[YOUR-PASSWORD]') || url?.includes('[PROJECT-REF]')) {
      problems.push(`${name} still contains template placeholders.`);
    }
  }

  if (problems.length) {
    console.error('✗ Not ready:\n' + problems.map((p) => `  • ${p}`).join('\n'));
    console.error('\n  Fix these in api/.env, then run this again.\n');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`select version()`;
    console.log('✓ Connected.');
    console.log(`  ${version.split(',')[0]}\n`);

    // Have the migrations been applied yet?
    try {
      const users = await prisma.user.count();
      const vendors = await prisma.vendor.count();
      console.log(`  Tables exist — ${users} users, ${vendors} vendors.`);
      if (vendors === 0) console.log('  Run `npm run seed` to load the demo data.\n');
      else console.log('  Ready to go: `npm run dev`\n');
    } catch {
      console.log('  No tables yet. Run:\n    npx prisma migrate dev --name init\n    npm run seed\n');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('✗ Could not connect.\n');
    if (message.includes('ENOTFOUND') || message.includes('EAI_AGAIN')) {
      console.error('  Host not found — check the project ref and region in the URL.');
    } else if (message.includes('password authentication failed')) {
      console.error('  Wrong password. Reset it: Supabase → Settings → Database → Reset password.');
    } else if (message.includes('ENETUNREACH') || message.includes('ECONNREFUSED')) {
      console.error('  Unreachable. If the host looks like db.<ref>.supabase.co, that is the');
      console.error('  IPv6-only direct connection — switch to the pooler URLs instead.');
    } else {
      console.error(`  ${message.split('\n')[0]}`);
    }
    console.error('');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
