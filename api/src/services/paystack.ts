import { createHmac, timingSafeEqual } from 'node:crypto';

import { env, features } from '@/config/env';
import { AppError, badRequest } from '@/lib/errors';

/**
 * Paystack (https://paystack.com) — cards, bank transfer and USSD in Naira.
 *
 * Amounts are already in kobo throughout this codebase, which is exactly what
 * Paystack expects, so nothing is converted here.
 *
 * To go live:
 *   1. Create a Paystack business and complete compliance.
 *   2. Copy the TEST keys into PAYSTACK_SECRET_KEY / PAYSTACK_PUBLIC_KEY.
 *   3. Add the webhook URL: POST {api-url}/api/v1/payments/webhook
 *   4. Swap to LIVE keys when you're ready to take real money.
 */

type InitResponse = {
  status: boolean;
  message: string;
  data: { authorization_url: string; access_code: string; reference: string };
};

type VerifyResponse = {
  status: boolean;
  message: string;
  data: {
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    paid_at: string | null;
    channel: string;
  };
};

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!features.paystack) {
    throw new AppError(
      503,
      'PAYMENTS_UNAVAILABLE',
      'Card payments are not configured yet. Pay with your Sendy Wallet, or add PAYSTACK_SECRET_KEY.'
    );
  }

  const res = await fetch(`${env.PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const payload = (await res.json()) as T & { message?: string };

  if (!res.ok) {
    throw new AppError(502, 'PAYSTACK_ERROR', payload.message ?? 'The payment provider rejected that request.');
  }

  return payload;
}

/** Starts a transaction and returns the checkout URL to open in the app. */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
}) {
  const body = await paystackFetch<InitResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      metadata: params.metadata ?? {},
      currency: 'NGN',
    }),
  });

  return body.data;
}

/**
 * Confirms a transaction with Paystack directly.
 *
 * Always verify server-side before granting value — a client saying "payment
 * succeeded" means nothing, and webhooks can be replayed or delayed.
 */
export async function verifyTransaction(reference: string) {
  const body = await paystackFetch<VerifyResponse>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return body.data;
}

/**
 * Validates the `x-paystack-signature` header against the raw request body.
 * Requires the UNPARSED body, which is why the webhook route mounts its own
 * raw body parser.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !env.PAYSTACK_SECRET_KEY) return false;

  const expected = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');

  // timingSafeEqual throws on length mismatch, so check that first.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function assertPaidInFull(paidKobo: number, expectedKobo: number) {
  if (paidKobo < expectedKobo) {
    throw badRequest('The amount paid is less than the order total.');
  }
}
