import type { Prisma } from '@prisma/client';

import { badRequest, conflict } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { paymentReference } from '@/lib/reference';

/**
 * The rider payout ledger.
 *
 * Money out is not money in with the sign flipped. A failed top-up costs a
 * customer a retry; a duplicated payout costs real money that nobody will send
 * back. So the shape here is deliberate:
 *
 *   - Nothing is payable until it has aged past the hold.
 *   - Selecting earnings, attaching them to a payout, and marking them paid is
 *     one transaction. There is no window where an earning is spoken for by a
 *     payout that does not exist, or free while a payout claims it.
 *   - The Payout row, with its unique reference, is written BEFORE Paystack is
 *     called. If the transfer succeeds and the response is lost, the reference
 *     is already on disk to reconcile against instead of being sent again.
 *
 * Phase 3 adds the transfer itself. This file deliberately does not call
 * Paystack: creating a payout marks earnings as paid, and until something
 * settles them that is a promise the system cannot keep on its own.
 */

/**
 * How long an earning waits before it can be paid out.
 *
 * Not caution for its own sake — it has to outlast the window in which an order
 * can still be refunded. Refunding voids the earning (see `voidEarningForOrder`),
 * and that only helps while the money is still here.
 */
export const PAYOUT_HOLD_HOURS = 24;

/**
 * Smallest payout worth making. Paystack charges per transfer, so paying out
 * ₦200 hands most of it to the bank. Riders under this roll into the next run.
 */
export const PAYOUT_MIN_KOBO = 200_000; // ₦2,000

export type PayableSummary = {
  riderId: string;
  payableKobo: number;
  heldKobo: number;
  earningIds: string[];
  meetsMinimum: boolean;
};

/** Everything a rider has earned that is settled, unpaid and past the hold. */
export async function payableFor(riderId: string, at = new Date()): Promise<PayableSummary> {
  const cutoff = new Date(at.getTime() - PAYOUT_HOLD_HOURS * 60 * 60 * 1000);

  const unpaid = await prisma.riderEarning.findMany({
    where: { riderId, isPaidOut: false, voidedAt: null },
    select: { id: true, netKobo: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const ready = unpaid.filter((e) => e.createdAt <= cutoff);
  const payableKobo = ready.reduce((sum, e) => sum + e.netKobo, 0);

  return {
    riderId,
    payableKobo,
    // What exists but has not aged yet, so the rider can see it is coming
    // rather than wondering where it went.
    heldKobo: unpaid.filter((e) => e.createdAt > cutoff).reduce((sum, e) => sum + e.netKobo, 0),
    earningIds: ready.map((e) => e.id),
    meetsMinimum: payableKobo >= PAYOUT_MIN_KOBO,
  };
}

/**
 * Creates a PENDING payout covering everything currently payable.
 *
 * Returns the payout with the earnings already attached and marked paid. The
 * caller is responsible for actually sending the money and for calling
 * `releaseFailedPayout` if it does not go through.
 *
 * `ignoreMinimum` exists for the admin override — sometimes a rider is leaving
 * and a ₦400 balance has to go out regardless of what it costs to send.
 */
export async function createPayout(
  riderId: string,
  options: { ignoreMinimum?: boolean; tx?: Prisma.TransactionClient } = {}
): Promise<{ id: string; reference: string; amountKobo: number; earningCount: number }> {
  const build = async (tx: Prisma.TransactionClient) => {
    const rider = await tx.rider.findUnique({
      where: { id: riderId },
      select: { bankCode: true, bankAccountNo: true, bankName: true, bankAccountName: true },
    });
    if (!rider) throw badRequest('No such rider.');
    if (!rider.bankCode || !rider.bankAccountNo || !rider.bankAccountName) {
      throw conflict('This rider has not added a verified payout account yet.');
    }

    const cutoff = new Date(Date.now() - PAYOUT_HOLD_HOURS * 60 * 60 * 1000);

    /**
     * Re-read inside the transaction rather than trusting `payableFor`.
     *
     * Between a caller checking and calling, a delivery can complete or a
     * refund can void an earning. The set that gets paid must be the set that
     * was true at the moment of writing, not a moment earlier.
     */
    const ready = await tx.riderEarning.findMany({
      where: { riderId, isPaidOut: false, voidedAt: null, createdAt: { lte: cutoff } },
      select: { id: true, netKobo: true },
    });

    const amountKobo = ready.reduce((sum, e) => sum + e.netKobo, 0);
    if (amountKobo <= 0) throw conflict('This rider has nothing payable right now.');
    if (!options.ignoreMinimum && amountKobo < PAYOUT_MIN_KOBO) {
      throw conflict(
        `Payable balance is below the ₦${(PAYOUT_MIN_KOBO / 100).toLocaleString()} minimum.`
      );
    }

    const payout = await tx.payout.create({
      data: {
        riderId,
        amountKobo,
        status: 'PENDING',
        reference: paymentReference('PAY'),
        // Snapshotted: the rider may change banks later, and what a past payout
        // says about where the money went must not change with them.
        bankName: rider.bankName,
        bankAccountNo: rider.bankAccountNo,
      },
      select: { id: true, reference: true, amountKobo: true },
    });

    const claimed = await tx.riderEarning.updateMany({
      // The status predicates are repeated here on purpose. This is the write
      // that actually claims the rows, so it must not depend on the read above
      // still being true.
      where: { id: { in: ready.map((e) => e.id) }, isPaidOut: false, voidedAt: null },
      data: { isPaidOut: true, paidOutAt: new Date(), payoutId: payout.id },
    });

    if (claimed.count !== ready.length) {
      // Something else claimed an earning mid-flight. Abort rather than pay a
      // total that no longer matches the rows behind it.
      throw conflict('Earnings changed while building this payout. Try again.');
    }

    return { ...payout, earningCount: claimed.count };
  };

  return options.tx ? build(options.tx) : prisma.$transaction(build);
}

/**
 * Returns a failed payout's earnings to the payable pool.
 *
 * The step people skip. Without it a transfer that bounces leaves the earnings
 * marked paid forever: the rider is owed money the system believes it already
 * sent, and nothing surfaces it. Called from the transfer webhook in phase 3.
 */
export async function releaseFailedPayout(
  payoutId: string,
  status: 'FAILED' | 'REVERSED',
  failureReason?: string,
  tx?: Prisma.TransactionClient
) {
  const run = async (client: Prisma.TransactionClient) => {
    await client.riderEarning.updateMany({
      where: { payoutId },
      data: { isPaidOut: false, paidOutAt: null, payoutId: null },
    });
    await client.payout.update({
      where: { id: payoutId },
      data: { status, failureReason: failureReason ?? null, settledAt: new Date() },
    });
  };

  return tx ? run(tx) : prisma.$transaction(run);
}

/**
 * Voids the rider earning behind a refunded order.
 *
 * Refunding used to touch the customer's wallet and the payment row and stop
 * there, leaving the rider still owed for a sale that had been reversed. That
 * was invisible while no money moved. It stops being invisible the day
 * transfers go live, so it is closed now rather than then.
 *
 * Only unpaid earnings can be voided. If the money is already gone, the earning
 * is left alone and `alreadyPaid` comes back true — that is a conversation with
 * the rider, not something to silently rewrite.
 */
export async function voidEarningForOrder(
  orderId: string,
  reason: string,
  tx: Prisma.TransactionClient
): Promise<{ voided: boolean; alreadyPaid: boolean }> {
  const earning = await tx.riderEarning.findUnique({
    where: { orderId },
    select: { id: true, isPaidOut: true, voidedAt: true },
  });

  if (!earning || earning.voidedAt) return { voided: false, alreadyPaid: false };
  if (earning.isPaidOut) return { voided: false, alreadyPaid: true };

  await tx.riderEarning.update({
    where: { id: earning.id },
    data: { voidedAt: new Date(), voidReason: reason },
  });

  return { voided: true, alreadyPaid: false };
}
