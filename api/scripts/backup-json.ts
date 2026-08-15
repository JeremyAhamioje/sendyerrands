import 'dotenv/config';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

/**
 * Dumps every table in `public` to JSON, one file per table.
 *
 * A stand-in for pg_dump, which needs the Postgres client tools installed and a
 * session-mode connection — DATABASE_URL here points at Supabase's transaction
 * pooler on 6543, which pg_dump cannot use. This goes through the connection the
 * app already has.
 *
 * Deliberately raw SQL. The Prisma schema and the live database have diverged
 * (email and passwordHash exist in one and not the other), so every typed query
 * fails right now — `SELECT *` does not care.
 *
 * This is insurance before a destructive migration, not a restore plan. The rows
 * are all here, but putting them back means writing inserts against whatever the
 * new schema turns out to be.
 *
 *   npx tsx scripts/backup-json.ts [outputDir]
 *
 * The output contains password hashes, phone numbers, addresses and payment
 * references. It defaults to a directory OUTSIDE the repository so it cannot be
 * committed. Keep it somewhere you would keep a database password.
 */
const prisma = new PrismaClient();

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = process.argv[2] ?? join('C:', 'Users', 'jenni', 'Downloads', 'sendy-backups', stamp);

/** JSON.stringify cannot serialise BigInt, and Postgres int8 arrives as one. */
function replacer(_key: string, value: unknown) {
  return typeof value === 'bigint' ? value.toString() : value;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  console.log(`\n  Writing to ${outDir}\n`);

  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  if (tables.length === 0) {
    console.error('  ✗ No tables found. Is the database awake and reachable?\n');
    process.exit(1);
  }

  let total = 0;
  const manifest: Record<string, number> = {};

  for (const { tablename } of tables) {
    // Identifier is quoted rather than interpolated bare: table names come from
    // the catalogue here, but an unquoted one breaks on any mixed-case name.
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM public."${tablename}"`
    );
    writeFileSync(join(outDir, `${tablename}.json`), JSON.stringify(rows, replacer, 2), 'utf8');

    manifest[tablename] = rows.length;
    total += rows.length;
    console.log(`  ${String(rows.length).padStart(6)}  ${tablename}`);
  }

  writeFileSync(
    join(outDir, '_manifest.json'),
    JSON.stringify({ takenAt: new Date().toISOString(), tables: manifest, total }, null, 2),
    'utf8'
  );

  console.log(`\n  ✓ ${total} rows across ${tables.length} tables`);
  console.log(`  ${outDir}\n`);
}

main()
  .catch((err) => {
    console.error('\n  ✗ Backup failed:', err instanceof Error ? err.message : err);
    console.error('  Nothing was written. Do NOT run the migration.\n');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
