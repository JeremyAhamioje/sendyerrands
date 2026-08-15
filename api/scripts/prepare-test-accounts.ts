import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

/**
 * Puts the two end-to-end test accounts into a state where the errand loop can
 * actually be walked.
 *
 * Registration alone is not enough: a new rider is PENDING and offline, so the
 * job board refuses them, and a new customer has no address and no wallet, so
 * there is nothing to deliver to and no way to pay the dispatch fee without a
 * card round trip. Both are one-line facts that cost twenty minutes to discover
 * from inside the app.
 *
 * Idempotent — safe to re-run after a reseed.
 *
 *   npx tsx scripts/prepare-test-accounts.ts
 */
const prisma = new PrismaClient();

const CUSTOMER_EMAIL = 'test.customer@sendyerrands.com';
const RIDER_EMAIL = 'test.rider@sendyerrands.com';

async function main() {
  const rider = await prisma.rider.update({
    where: { email: RIDER_EMAIL },
    // APPROVED is what requireApprovedRider checks before letting anyone accept
    // a job; isOnline is what the board's own badge reads.
    data: { status: 'APPROVED', isOnline: true, zone: 'Victoria Island' },
    select: { email: true, status: true, isOnline: true, plateNumber: true },
  });

  const user = await prisma.user.findUnique({ where: { email: CUSTOMER_EMAIL } });
  if (!user) throw new Error(`${CUSTOMER_EMAIL} does not exist — register it first`);

  // Enough to cover several dispatch fees, so testing never stalls on a card.
  await prisma.user.update({
    where: { id: user.id },
    data: { walletBalanceKobo: 2_000_000 },
  });

  const hasAddress = await prisma.address.count({ where: { userId: user.id } });
  if (hasAddress === 0) {
    await prisma.address.create({
      data: {
        userId: user.id,
        label: 'Home',
        line1: '14 Adeola Odeku Street',
        city: 'Victoria Island',
        landmark: 'Beside Zenith Bank',
        contact: 'Test Customer',
        phone: '+2348100000001',
        isDefault: true,
      },
    });
  }

  const customer = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      walletBalanceKobo: true,
      referralCode: true,
      _count: { select: { addresses: true } },
    },
  });

  console.log('\n  rider');
  console.log(`    ${rider.email}`);
  console.log(`    ${rider.status} · ${rider.isOnline ? 'online' : 'offline'} · ${rider.plateNumber}`);
  console.log('\n  customer');
  console.log(`    ${customer!.email}`);
  console.log(
    `    wallet ₦${(customer!.walletBalanceKobo / 100).toLocaleString('en-NG')} · ` +
      `${customer!._count.addresses} address · referral ${customer!.referralCode}`
  );
  console.log('\n  password for both: sendy-test-2026\n');
}

main()
  .catch((err) => {
    console.error('\n  ✗', err instanceof Error ? err.message : err, '\n');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
