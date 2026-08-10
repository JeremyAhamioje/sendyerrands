import type { Prisma } from '@prisma/client';

import { AppError, badRequest, conflict } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { paymentReference } from '@/lib/reference';
import {
  createTransferRecipient,
  fetchAvailableBalanceKobo,
  initiateTransfer,
  verifyTransfer,
} from '@/services/paystack';

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
 *   - Only a refusal we actually heard unwinds a payout. Silence does not,
 *     because silence and success are indistinguishable from here.
 *
 * The state machine is deliberately not symmetrical. REVERSED is the single
 * terminal state: a bank can accept a transfer and bounce it days later, so
 * reversal must be able to follow success, while a stray `failed` arriving
 * after a real payment must not unwind it.
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

/**
 * Paystack's own floor: it refuses any transfer under ₦50 outright.
 *
 * Separate from PAYOUT_MIN_KOBO because it is not ours to choose. The admin
 * override can waive our minimum; it cannot waive the provider's, and without
 * this check the override would cheerfully build a payout, mark the earnings
 * paid, call Paystack, be refused, and unwind — a round trip that was never
 * going to work. Found by probing the live API, not by reading the docs.
 */
export const PROVIDER_MIN_TRANSFER_KOBO = 5_000; // ₦50

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
 * Creates a payout and sends it.
 *
 * The order is the point. The Payout row, with its unique reference, is
 * committed before Paystack is contacted, so there is never a moment where
 * money has been sent against nothing on disk.
 *
 * What happens when the send fails is the part worth reading twice:
 *
 *   - Paystack answered and refused → the transfer does not exist, so the
 *     earnings go back in the pool and the payout is marked FAILED.
 *   - We could not reach Paystack → the transfer may exist. The payout stays
 *     PENDING and the earnings stay claimed. Releasing them here is how the
 *     same work gets paid twice, and a stuck payout is recoverable in a way
 *     that a double payment is not. `reconcilePayout` resolves it.
 */
export async function sendPayout(
  riderId: string,
  options: { ignoreMinimum?: boolean } = {}
) {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    select: {
      firstName: true,
      lastName: true,
      bankCode: true,
      bankAccountNo: true,
      bankAccountName: true,
      paystackRecipientCode: true,
    },
  });
  if (!rider) throw badRequest('No such rider.');
  if (!rider.bankCode || !rider.bankAccountNo || !rider.bankAccountName) {
    throw conflict('This rider has not added a verified payout account yet.');
  }

  // Everything that can fail without consequence happens before the payout row
  // exists: a rider with no recipient or an underfunded balance should not
  // leave a PENDING payout behind for someone to reconcile.
  let recipientCode = rider.paystackRecipientCode;
  if (!recipientCode) {
    recipientCode = await createTransferRecipient({
      // The bank's name for the account, not ours. If those disagree, the bank
      // is right, and the disagreement is worth seeing on the Paystack side.
      name: rider.bankAccountName,
      accountNumber: rider.bankAccountNo,
      bankCode: rider.bankCode,
    });
    await prisma.rider.update({
      where: { id: riderId },
      data: { paystackRecipientCode: recipientCode },
    });
  }

  const preview = await payableFor(riderId);
  if (preview.payableKobo <= 0) throw conflict('This rider has nothing payable right now.');
  if (preview.payableKobo < PROVIDER_MIN_TRANSFER_KOBO) {
    throw conflict(
      `Paystack will not send less than ₦${(PROVIDER_MIN_TRANSFER_KOBO / 100).toLocaleString()}. ` +
        `This rider is owed ₦${(preview.payableKobo / 100).toLocaleString()}.`
    );
  }

  const available = await fetchAvailableBalanceKobo();
  if (available < preview.payableKobo) {
    throw conflict(
      `Your Paystack balance is ₦${(available / 100).toLocaleString()} and this payout needs ` +
        `₦${(preview.payableKobo / 100).toLocaleString()}. Fund the balance and try again.`
    );
  }

  const payout = await createPayout(riderId, { ignoreMinimum: options.ignoreMinimum });

  await prisma.payout.update({
    where: { id: payout.id },
    data: { recipientCode },
  });

  try {
    const transfer = await initiateTransfer({
      amountKobo: payout.amountKobo,
      recipientCode,
      reference: payout.reference,
      reason: `Sendy Errands rider payout — ${rider.firstName} ${rider.lastName}`,
    });

    /**
     * `otp` means the business still has "Transfers OTP" switched on, and this
     * transfer is parked waiting for a code nobody is going to type. Treated as
     * a failure rather than left in PROCESSING, because a payout that silently
     * waits forever is worse than one that says what is wrong.
     */
    if (transfer.status === 'otp') {
      await releaseFailedPayout(
        payout.id,
        'FAILED',
        'Transfers OTP is enabled on this Paystack account, so the transfer cannot complete unattended.'
      );
      throw conflict(
        'Transfers OTP is enabled on your Paystack account. Ask Paystack to disable it, then retry.'
      );
    }

    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: transfer.status === 'success' ? 'SUCCESS' : 'PROCESSING',
        transferCode: transfer.transfer_code,
        providerPayload: transfer as never,
        ...(transfer.status === 'success' ? { settledAt: new Date() } : {}),
      },
    });

    return { ...payout, status: transfer.status, transferCode: transfer.transfer_code };
  } catch (err) {
    if (err instanceof AppError && err.code === 'PAYSTACK_ERROR') {
      await releaseFailedPayout(payout.id, 'FAILED', err.message);
      throw conflict(`Paystack refused the transfer: ${err.message}`);
    }
    // Includes PAYSTACK_UNREACHABLE and our own `otp` conflict above, both of
    // which have already put the payout in the right state — or deliberately
    // left it alone.
    throw err;
  }
}

/**
 * Asks Paystack what became of a payout and settles it.
 *
 * The fallback for anything the webhook did not deliver, and the way a payout
 * stuck in PENDING after an unreachable provider gets resolved. Safe to call
 * repeatedly: it only ever moves a payout to the state Paystack reports.
 */
export async function reconcilePayout(payoutId: string) {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: { id: true, reference: true, status: true },
  });
  if (!payout) throw badRequest('No such payout.');
  if (payout.status === 'SUCCESS' || payout.status === 'REVERSED') return payout;

  let transfer;
  try {
    transfer = await verifyTransfer(payout.reference);
  } catch (err) {
    /**
     * A reference Paystack has never seen means the transfer was never created
     * — the case where our request died on the way out. Only then is it safe to
     * give the earnings back.
     */
    if (err instanceof AppError && err.code === 'PAYSTACK_ERROR') {
      await releaseFailedPayout(payout.id, 'FAILED', 'Paystack has no record of this transfer.');
      return { ...payout, status: 'FAILED' as const };
    }
    throw err;
  }

  return settleTransfer(payout.reference, transfer.status, transfer as unknown);
}

/**
 * Applies a terminal transfer status to the payout behind a reference.
 *
 * Shared by the webhook and by reconciliation so the two cannot drift, and
 * idempotent so a webhook retry after a manual reconcile changes nothing.
 */
export async function settleTransfer(
  reference: string,
  status: string,
  payload?: unknown,
  client: Prisma.TransactionClient = prisma
) {
  const payout = await client.payout.findUnique({
    where: { reference },
    select: { id: true, status: true },
  });
  if (!payout) return null;

  /**
   * Reversal has to be able to follow success.
   *
   * A bank can accept a transfer and bounce it days later, so `transfer.success`
   * then `transfer.reversed` is a normal sequence, not a contradiction. Treating
   * SUCCESS as terminal — which this did — meant that reversal was dropped on
   * the floor: the money came back to us, the earnings stayed marked paid, and
   * the rider was quietly owed for work the system believed it had settled.
   *
   * REVERSED is the only genuinely final state. Everything else can still move.
   */
  if (payout.status === 'REVERSED') return payout;

  if (status === 'reversed') {
    await releaseFailedPayout(payout.id, 'REVERSED', 'Paystack reversed the transfer.', client);
    return client.payout.findUnique({ where: { id: payout.id } });
  }

  // Past this point a settled payout has nothing left to learn.
  if (payout.status === 'SUCCESS') return payout;

  if (status === 'success') {
    return client.payout.update({
      where: { id: payout.id },
      data: { status: 'SUCCESS', settledAt: new Date(), providerPayload: payload as never },
    });
  }

  if (status === 'failed' || status === 'abandoned') {
    await releaseFailedPayout(payout.id, 'FAILED', `Paystack reported the transfer as ${status}.`, client);
    return client.payout.findUnique({ where: { id: payout.id } });
  }

  // Still in flight (pending/otp) — nothing terminal to record yet.
  return payout;
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
