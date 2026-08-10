/**
 * Exercises the payout ledger against the real database and writes nothing.
 *
 * Everything runs inside one interactive transaction that always throws at the
 * end, so Postgres rolls it back. The database this points at is shared with
 * production, and a test that leaves half-built payouts behind is worse than no
 * test at all.
 *
 *   npx tsx scripts/test-payouts.ts
 */
import { prisma } from '../src/lib/prisma';
import {
  PAYOUT_HOLD_HOURS,
  PAYOUT_MIN_KOBO,
  createPayout,
  payableFor,
  releaseFailedPayout,
} from '../src/services/payouts';

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`;
const ROLLBACK = 'ROLLBACK — this is deliberate';

function check(label: string, pass: boolean, detail = '') {
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  console.log(`hold=${PAYOUT_HOLD_HOURS}h  minimum=${naira(PAYOUT_MIN_KOBO)}\n`);

  const riders = await prisma.rider.findMany({
    select: { id: true, firstName: true, lastName: true, bankAccountName: true },
  });

  console.log('payable by rider (read-only):');
  const summaries = [];
  for (const r of riders) {
    // Sequential and awaited up front: `find` with an async predicate matches
    // the first rider every time, because a Promise is always truthy.
    const p = await payableFor(r.id);
    summaries.push({ rider: r, ...p });
    console.log(
      `  ${r.firstName} ${r.lastName}: payable ${naira(p.payableKobo)}, held ${naira(p.heldKobo)}, ` +
        `${p.earningIds.length} earning(s), account ${r.bankAccountName ?? 'NOT SET'}`
    );
  }

  // The rider with the most unpaid work, so the exercise has something to move.
  const owedCounts = await Promise.all(
    riders.map(async (r) => ({
      rider: r,
      unpaid: await prisma.riderEarning.count({
        where: { riderId: r.id, isPaidOut: false, voidedAt: null },
      }),
    }))
  );
  const subject = owedCounts.sort((a, b) => b.unpaid - a.unpaid)[0]?.rider;
  if (!subject) return console.log('\nNo riders seeded — nothing to exercise.');

  console.log(`\nexercising with ${subject.firstName} ${subject.lastName} (rolled back):`);

  try {
    await prisma.$transaction(
      async (tx) => {
        // A payout account is required before money can be aimed anywhere.
        await tx.rider.update({
          where: { id: subject.id },
          data: {
            bankCode: '044',
            bankAccountNo: '0000000000',
            bankName: 'Access Bank',
            bankAccountName: 'TEST ACCOUNT',
          },
        });

        // Age every unpaid earning past the hold so there is something payable.
        const old = new Date(Date.now() - (PAYOUT_HOLD_HOURS + 1) * 3600_000);
        await tx.riderEarning.updateMany({
          where: { riderId: subject.id, isPaidOut: false, voidedAt: null },
          data: { createdAt: old },
        });

        const before = await tx.riderEarning.aggregate({
          where: { riderId: subject.id, isPaidOut: false, voidedAt: null },
          _sum: { netKobo: true },
        });
        const owed = before._sum.netKobo ?? 0;
        console.log(`  owed before: ${naira(owed)}`);
        if (owed === 0) throw new Error(ROLLBACK);

        const payout = await createPayout(subject.id, { tx, ignoreMinimum: true });
        check('payout covers the full owed amount', payout.amountKobo === owed, naira(payout.amountKobo));
        check('reference is set', Boolean(payout.reference), payout.reference);

        const claimed = await tx.riderEarning.count({ where: { payoutId: payout.id } });
        check('every earning is attached to the payout', claimed === payout.earningCount);

        const stillPayable = await tx.riderEarning.aggregate({
          where: { riderId: subject.id, isPaidOut: false, voidedAt: null },
          _sum: { netKobo: true },
        });
        check('nothing remains payable afterwards', (stillPayable._sum.netKobo ?? 0) === 0);

        // The one that matters: a second run must not pay the same work twice.
        let refused = false;
        try {
          await createPayout(subject.id, { tx, ignoreMinimum: true });
        } catch {
          refused = true;
        }
        check('a second payout is refused (no double-pay)', refused);

        // A failed transfer has to give the work back, or the rider is owed
        // money the system believes it already sent.
        await releaseFailedPayout(payout.id, 'FAILED', 'test', tx);
        const returned = await tx.riderEarning.aggregate({
          where: { riderId: subject.id, isPaidOut: false, voidedAt: null },
          _sum: { netKobo: true },
        });
        check('a failed payout returns the earnings', (returned._sum.netKobo ?? 0) === owed, naira(returned._sum.netKobo ?? 0));

        const after = await tx.payout.findUnique({ where: { id: payout.id }, select: { status: true } });
        check('the payout is marked FAILED', after?.status === 'FAILED');

        throw new Error(ROLLBACK);
      },
      { timeout: 30_000 }
    );
  } catch (err) {
    if (!(err instanceof Error) || err.message !== ROLLBACK) throw err;
    console.log('\n  rolled back — no rows written');
  }

  const payouts = await prisma.payout.count();
  check('database has no payout rows left behind', payouts === 0, `count=${payouts}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
