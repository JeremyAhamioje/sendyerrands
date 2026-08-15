import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

/**
 * The scripts/enable-rls.sql policy, applied without psql.
 *
 * Same effect, run through the connection the app already has, because the
 * Postgres client tools are not installed here. See the .sql file for the full
 * reasoning; the short version is that Supabase publishes PostgREST under the
 * `anon` key — a key designed to be public — and every table in `public`
 * without RLS is readable through it. This schema holds password hashes, reset
 * code hashes and rider identity documents.
 *
 * RLS with NO policies denies everything to `anon` and `authenticated`: no
 * policy means no row ever matches. Prisma is unaffected because Postgres
 * exempts a table's owner from its own policies unless FORCE ROW LEVEL SECURITY
 * is set, which it is not.
 *
 * Idempotent. Re-run after any migration that creates a table.
 *
 *   npx tsx scripts/enable-rls.ts
 */
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  console.log(`\n  ${tables.length} tables in public\n`);

  for (const { tablename } of tables) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public."${tablename}" ENABLE ROW LEVEL SECURITY`);
  }

  // Belt and braces: revoking the grants means a table created later without
  // RLS is not silently exposed in the gap before anyone re-runs this.
  for (const role of ['anon', 'authenticated']) {
    const exists = await prisma.$queryRawUnsafe<{ ok: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') AS ok`
    );
    if (!exists[0]?.ok) {
      console.log(`  role ${role} not present — skipped`);
      continue;
    }
    await prisma.$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role}`);
    await prisma.$executeRawUnsafe(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${role}`);
    await prisma.$executeRawUnsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${role}`
    );
    console.log(`  revoked public schema grants from ${role}`);
  }

  const after = await prisma.$queryRawUnsafe<{ tablename: string; rowsecurity: boolean }[]>(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY rowsecurity, tablename`
  );

  const open = after.filter((t) => !t.rowsecurity);
  console.log('');
  if (open.length === 0) {
    console.log(`  ✓ RLS enabled on all ${after.length} tables\n`);
  } else {
    console.error(`  ✗ still without RLS: ${open.map((t) => t.tablename).join(', ')}\n`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('\n  ✗ Failed:', err instanceof Error ? err.message : err, '\n');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
