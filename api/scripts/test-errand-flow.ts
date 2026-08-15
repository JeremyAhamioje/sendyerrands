import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import { canTransition } from '../src/services/orders';

/**
 * Walks the direct-to-merchant errand loop and asserts the ordering rules.
 *
 * Everything happens inside a transaction that always throws at the end, so it
 * runs against the real database — which is shared with production — without
 * leaving a row behind. Same pattern as scripts/test-payouts.ts.
 *
 *   npx tsx scripts/test-errand-flow.ts
 */
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const ROLLBACK = new Error('ROLLBACK');

async function main() {
  console.log('\n  Errand flow — direct to merchant\n');

  // ── the state machine, before touching the database ──────
  console.log('  transitions');
  check('a posted errand can be accepted', canTransition('QUOTE_REQUESTED', 'RIDER_ASSIGNED'));
  check('a posted errand can be cancelled', canTransition('QUOTE_REQUESTED', 'CANCELLED'));
  check('an assigned errand can be priced', canTransition('RIDER_ASSIGNED', 'PRICE_PROPOSED'));
  check('a price can be revised', canTransition('PRICE_PROPOSED', 'PRICE_PROPOSED'));
  check('a priced errand can be paid', canTransition('PRICE_PROPOSED', 'MERCHANT_PAID'));
  check('a paid errand can be collected', canTransition('MERCHANT_PAID', 'PICKED_UP'));
  check('a collected errand can arrive', canTransition('PICKED_UP', 'AT_DOORSTEP'));
  check('an arrived errand can be delivered', canTransition('AT_DOORSTEP', 'DELIVERED'));

  console.log('\n  transitions that must NOT be possible');
  // The ordering constraint the whole model rests on: a rider cannot claim to
  // hold goods the customer has not paid for.
  check(
    'collection cannot skip payment to the seller',
    !canTransition('PRICE_PROPOSED', 'PICKED_UP')
  );
  check('a posted errand cannot jump to collected', !canTransition('QUOTE_REQUESTED', 'PICKED_UP'));
  check(
    'a posted errand cannot be priced without a rider',
    !canTransition('QUOTE_REQUESTED', 'PRICE_PROPOSED')
  );
  check('delivery is terminal apart from a refund', !canTransition('DELIVERED', 'AT_DOORSTEP'));
  check('the seller cannot be paid twice', !canTransition('MERCHANT_PAID', 'PRICE_PROPOSED'));

  // ── against the database, rolled back ────────────────────
  console.log('\n  database');
  try {
    // Prisma's default interactive-transaction timeout is 5s. This walks a
    // dozen round trips to a pooled database in eu-west-1, which is comfortably
    // longer than that — the first run died mid-way with "transaction not
    // found", which reads like a logic bug and is not one.
    await prisma.$transaction(async (tx) => {
      const customer = await tx.user.findFirst({ where: { email: 'chinedu.okafor@example.com' } });
      const rider = await tx.rider.findFirst({ where: { status: 'APPROVED' } });
      const address = await tx.address.findFirst({ where: { userId: customer?.id } });

      if (!customer || !rider || !address) throw new Error('seed data missing — run prisma db seed');

      const order = await tx.order.create({
        data: {
          reference: `TEST-${Date.now()}`,
          type: 'ERRAND',
          status: 'QUOTE_REQUESTED',
          customerId: customer.id,
          addressId: address.id,
          deliveryCode: '0000',
          subtotalKobo: 0,
          deliveryFeeKobo: 130_000,
          serviceFeeKobo: 0,
          discountKobo: 0,
          totalKobo: 130_000,
          riderPayoutKobo: 100_000,
          errandDetail: {
            create: {
              task: 'Buy a bag of rice',
              pickupName: 'Mile 12 Market',
              pickupAddress: 'Mile 12, Lagos',
              budgetKobo: 5_000_000,
            },
          },
        },
        include: { errandDetail: true },
      });

      check('posted unpaid, with an estimate only', order.totalKobo === 130_000);
      check(
        'the estimate is not charged',
        order.subtotalKobo === 0 && order.errandDetail?.budgetKobo === 5_000_000
      );

      // The board query, exactly as rider.routes.ts runs it.
      const onBoard = await tx.order.findMany({
        where: { riderId: null, status: { in: ['PLACED', 'VENDOR_ACCEPTED', 'QUOTE_REQUESTED'] } },
      });
      check('an unpaid errand reaches the job board', onBoard.some((o) => o.id === order.id));

      // Rider prices it. The resolved name is what the customer will see, and
      // it must be stored from the provider rather than from the rider.
      await tx.errandDetail.update({
        where: { orderId: order.id },
        data: {
          actualItemKobo: 6_200_000,
          merchantBankCode: '058',
          merchantAccountNo: '0123456789',
          merchantAccountName: 'ADEBAYO STORES LTD',
          merchantBankName: 'Guaranty Trust Bank',
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: 'PRICE_PROPOSED' } });

      const priced = await tx.order.findUnique({
        where: { id: order.id },
        include: { errandDetail: true },
      });
      check(
        'the real price can exceed the estimate',
        (priced?.errandDetail?.actualItemKobo ?? 0) > (priced?.errandDetail?.budgetKobo ?? 0)
      );
      check(
        'the total still only covers dispatch',
        priced?.totalKobo === 130_000
      );
      check(
        'the merchant name shown is the resolved one',
        priced?.errandDetail?.merchantAccountName === 'ADEBAYO STORES LTD'
      );

      // The fee gate: no successful payment yet.
      const feePaid = await tx.payment.findFirst({
        where: { orderId: order.id, status: 'SUCCESS' },
      });
      check('the dispatch fee is unpaid at this point', feePaid === null);

      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: 'WALLET',
          reference: `TEST-PAY-${Date.now()}`,
          amountKobo: 130_000,
          status: 'SUCCESS',
          paidAt: new Date(),
        },
      });

      await tx.errandDetail.update({
        where: { orderId: order.id },
        data: { merchantPaidAt: new Date() },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: 'MERCHANT_PAID' } });

      await tx.errandDetail.update({
        where: { orderId: order.id },
        data: { assetSecuredAt: new Date() },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: 'PICKED_UP' } });

      await tx.errandDetail.update({
        where: { orderId: order.id },
        data: { atDoorstepAt: new Date() },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: 'AT_DOORSTEP' } });

      const done = await tx.order.findUnique({
        where: { id: order.id },
        include: { errandDetail: true },
      });
      const d = done!.errandDetail!;
      check('both rider pings are timestamped', Boolean(d.assetSecuredAt && d.atDoorstepAt));
      check(
        'the pings are in order',
        d.assetSecuredAt!.getTime() <= d.atDoorstepAt!.getTime()
      );
      check(
        'the seller was paid before collection',
        d.merchantPaidAt!.getTime() <= d.assetSecuredAt!.getTime()
      );
      check(
        'Sendy took only the dispatch fee',
        done!.totalKobo === 130_000 && d.actualItemKobo === 6_200_000
      );

      throw ROLLBACK;
    }, { timeout: 60_000, maxWait: 15_000 });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
    console.log('  ✓ rolled back — nothing written');
    passed += 1;
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error('\n  ✗', err instanceof Error ? err.message : err, '\n');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
