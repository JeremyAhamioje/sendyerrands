import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { badRequest, conflict, notFound } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { paymentReference } from '@/lib/reference';
import { asyncHandler, validate } from '@/middleware';
import { requireAuth } from '@/middleware/auth';
import { transitionOrder } from '@/services/orders';
import { initializeTransaction, verifyTransaction, verifyWebhookSignature } from '@/services/paystack';

export const paymentsRouter = Router();

/**
 * POST /payments/checkout
 *
 * WALLET  → debits immediately and places the order.
 * PAYSTACK→ returns an authorization_url for the app to open. The order is only
 *           placed once the payment is confirmed by /verify or the webhook.
 */
paymentsRouter.post(
  '/checkout',
  requireAuth('customer'),
  validate(
    z.object({
      orderId: z.string().min(1),
      method: z.enum(['WALLET', 'PAYSTACK']),
    })
  ),
  asyncHandler(async (req, res) => {
    const customerId = req.auth!.id;
    const { orderId, method } = req.body as { orderId: string; method: 'WALLET' | 'PAYSTACK' };

    const order = await prisma.order.findFirst({ where: { id: orderId, customerId } });
    if (!order) throw notFound('Order');
    if (order.status !== 'PENDING_PAYMENT') throw conflict('This order has already been paid for.');

    if (method === 'WALLET') {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: customerId } });
        if (!user) throw notFound('Account');
        if (user.walletBalanceKobo < order.totalKobo) {
          throw badRequest('Your wallet balance is too low. Top up or pay by card.');
        }

        const balanceKobo = user.walletBalanceKobo - order.totalKobo;

        await tx.user.update({ where: { id: customerId }, data: { walletBalanceKobo: balanceKobo } });

        await tx.walletTransaction.create({
          data: {
            userId: customerId,
            type: 'ORDER_DEBIT',
            amountKobo: -order.totalKobo,
            balanceKobo,
            description: `Order ${order.reference}`,
            reference: order.reference,
          },
        });

        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            provider: 'WALLET',
            reference: paymentReference('WLT'),
            amountKobo: order.totalKobo,
            status: 'SUCCESS',
            paidAt: new Date(),
          },
        });

        await transitionOrder(order.id, 'PLACED', { type: 'customer', id: customerId }, { tx });

        return { payment, balanceKobo };
      });

      return res.json({
        data: {
          method: 'WALLET',
          status: 'SUCCESS',
          walletBalanceKobo: result.balanceKobo,
          payment: result.payment,
        },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: customerId }, select: { email: true, phone: true } });
    const reference = paymentReference('PSK');

    const init = await initializeTransaction({
      // Paystack requires an email; fall back to a routable placeholder.
      email: user?.email ?? `${user?.phone?.replace('+', '')}@sendy.app`,
      amountKobo: order.totalKobo,
      reference,
      metadata: { orderId: order.id, orderReference: order.reference, customerId },
    });

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'PAYSTACK',
        reference,
        amountKobo: order.totalKobo,
        status: 'PENDING',
        authorizationUrl: init.authorization_url,
      },
    });

    res.json({
      data: {
        method: 'PAYSTACK',
        status: 'PENDING',
        authorizationUrl: init.authorization_url,
        reference: payment.reference,
      },
    });
  })
);

/**
 * POST /payments/verify — called when the app returns from the Paystack sheet.
 * Confirms with Paystack directly rather than trusting the client.
 */
paymentsRouter.post(
  '/verify',
  requireAuth('customer'),
  validate(z.object({ reference: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { reference } = req.body as { reference: string };

    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { order: true },
    });
    if (!payment) throw notFound('Payment');
    if (payment.order.customerId !== req.auth!.id) throw notFound('Payment');

    if (payment.status === 'SUCCESS') {
      return res.json({ data: { status: 'SUCCESS', orderId: payment.orderId } });
    }

    const result = await verifyTransaction(reference);
    await settlePayment(reference, result.status === 'success', result);

    res.json({
      data: {
        status: result.status === 'success' ? 'SUCCESS' : 'FAILED',
        orderId: payment.orderId,
      },
    });
  })
);

/** POST /payments/wallet/topup — funds the wallet via Paystack. */
paymentsRouter.post(
  '/wallet/topup',
  requireAuth('customer'),
  validate(z.object({ amountKobo: z.number().int().min(10_000) })),
  asyncHandler(async (req, res) => {
    const customerId = req.auth!.id;
    const { amountKobo } = req.body as { amountKobo: number };

    const user = await prisma.user.findUnique({
      where: { id: customerId },
      select: { email: true, phone: true },
    });

    const reference = paymentReference('TOP');
    const init = await initializeTransaction({
      email: user?.email ?? `${user?.phone?.replace('+', '')}@sendy.app`,
      amountKobo,
      reference,
      metadata: { kind: 'wallet_topup', customerId },
    });

    res.json({ data: { authorizationUrl: init.authorization_url, reference } });
  })
);

/**
 * POST /payments/webhook — Paystack's server-to-server callback.
 *
 * Mounted with a RAW body parser in app.ts: the HMAC is computed over the exact
 * bytes Paystack sent, so any re-serialisation breaks the signature.
 * Always 200 on a valid signature — a non-2xx makes Paystack retry for days.
 */
export const paystackWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-paystack-signature'];
  const raw = req.body as Buffer;

  if (!verifyWebhookSignature(raw, typeof signature === 'string' ? signature : undefined)) {
    return res.status(401).json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid signature.' } });
  }

  const event = JSON.parse(raw.toString('utf8')) as {
    event: string;
    data: { reference: string; status: string; amount: number; metadata?: Record<string, unknown> };
  };

  if (event.event === 'charge.success') {
    const kind = event.data.metadata?.kind;
    if (kind === 'wallet_topup') {
      await creditWallet(event.data.reference, event.data);
    } else {
      await settlePayment(event.data.reference, true, event.data);
    }
  }

  res.json({ received: true });
});

// ── helpers ─────────────────────────────────────────────────────────

/** Marks a payment settled and places the order. Idempotent. */
async function settlePayment(reference: string, success: boolean, payload: unknown) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { reference }, include: { order: true } });
    if (!payment) return;
    if (payment.status === 'SUCCESS') return; // already handled — webhook retry

    await tx.payment.update({
      where: { reference },
      data: {
        status: success ? 'SUCCESS' : 'FAILED',
        paidAt: success ? new Date() : null,
        providerPayload: payload as never,
      },
    });

    if (success && payment.order.status === 'PENDING_PAYMENT') {
      await transitionOrder(payment.orderId, 'PLACED', { type: 'system' }, { tx });
    }
  });
}

/** Credits a wallet top-up. Idempotent on the payment reference. */
async function creditWallet(reference: string, payload: { amount: number; metadata?: Record<string, unknown> }) {
  const customerId = payload.metadata?.customerId;
  if (typeof customerId !== 'string') return;

  await prisma.$transaction(async (tx) => {
    const already = await tx.walletTransaction.findFirst({ where: { reference } });
    if (already) return;

    const user = await tx.user.findUnique({ where: { id: customerId } });
    if (!user) return;

    const balanceKobo = user.walletBalanceKobo + payload.amount;

    await tx.user.update({ where: { id: customerId }, data: { walletBalanceKobo: balanceKobo } });
    await tx.walletTransaction.create({
      data: {
        userId: customerId,
        type: 'TOPUP',
        amountKobo: payload.amount,
        balanceKobo,
        description: 'Wallet top-up',
        reference,
      },
    });
  });
}
