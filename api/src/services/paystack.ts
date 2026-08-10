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
    // Echoed back exactly as sent to /transaction/initialize. This is how a
    // top-up is told apart from an order payment, and how it is tied to the
    // customer who started it.
    metadata?: Record<string, unknown>;
  };
};

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!features.paystack) {
    throw new AppError(
      503,
      'PAYMENTS_UNAVAILABLE',
      'Card payments are not configured yet. Pay with your Sendy Errands Wallet, or add PAYSTACK_SECRET_KEY.'
    );
  }

  /**
   * PAYSTACK_ERROR and PAYSTACK_UNREACHABLE are deliberately different codes.
   *
   * For money coming in the distinction barely matters — the customer retries.
   * For money going out it is the whole game. A rejection means Paystack
   * answered and did not create the transfer, so the payout can safely be
   * unwound. A network failure means the request may well have been received
   * and acted on, and unwinding it risks paying the same earnings twice.
   * Callers must be able to tell those apart, so they cannot share a code.
   */
  let res: Response;
  try {
    res = await fetch(`${env.PAYSTACK_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch (cause) {
    throw new AppError(
      504,
      'PAYSTACK_UNREACHABLE',
      'We could not reach the payment provider. The request may or may not have gone through.',
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }

  const payload = (await res.json().catch(() => null)) as (T & { message?: string }) | null;

  if (!res.ok) {
    throw new AppError(
      502,
      'PAYSTACK_ERROR',
      payload?.message ?? 'The payment provider rejected that request.'
    );
  }

  if (!payload) {
    throw new AppError(502, 'PAYSTACK_ERROR', 'The payment provider sent a response we could not read.');
  }

  return payload;
}

/** Starts a transaction and returns the checkout URL to open in the app. */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
  /**
   * Where Paystack sends the browser once the payment finishes. The app passes
   * its own deep link so the payment sheet closes itself instead of stranding
   * the customer on the dashboard's callback page. Omitted, Paystack falls back
   * to whatever is configured on the dashboard.
   */
  callbackUrl?: string;
}) {
  const body = await paystackFetch<InitResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      metadata: params.metadata ?? {},
      currency: 'NGN',
      ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
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

// ── payout destinations ─────────────────────────────────────────────

export type Bank = { name: string; code: string; slug: string };

type BankListResponse = { status: boolean; data: { name: string; code: string; slug: string }[] };
type ResolveResponse = { status: boolean; data: { account_number: string; account_name: string } };

/**
 * Nigerian bank list, cached in memory for a day.
 *
 * It runs to a couple of hundred entries and changes when a bank is licensed or
 * merges — not often enough to fetch on every rider who opens the form, and not
 * static enough to hardcode.
 */
let bankCache: { at: number; banks: Bank[] } | null = null;
const BANK_TTL_MS = 24 * 60 * 60 * 1000;

export async function listBanks(): Promise<Bank[]> {
  if (bankCache && Date.now() - bankCache.at < BANK_TTL_MS) return bankCache.banks;

  const body = await paystackFetch<BankListResponse>('/bank?currency=NGN&country=nigeria');
  const banks = body.data
    .map((b) => ({ name: b.name, code: b.code, slug: b.slug }))
    .sort((a, b) => a.name.localeCompare(b.name));

  bankCache = { at: Date.now(), banks };
  return banks;
}

/**
 * Asks the bank who owns an account number.
 *
 * This is the only check that stands between a typo and money landing in a
 * stranger's account, and it is why the resolved name is stored rather than
 * anything the rider typed. A transfer to a valid-but-wrong account is not
 * recoverable by us — it is a bank dispute, and the money is gone in the
 * meantime.
 */
export async function resolveAccount(accountNumber: string, bankCode: string) {
  try {
    const body = await paystackFetch<ResolveResponse>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
    );
    return { accountNumber: body.data.account_number, accountName: body.data.account_name };
  } catch (err) {
    // Paystack answers a wrong number with a 4xx, which paystackFetch turns
    // into a 502. That reads as "our provider is broken" when the truth is
    // "check the digits", so it is worth restating.
    if (err instanceof AppError && err.code === 'PAYSTACK_ERROR') {
      throw badRequest(
        'We could not find that account. Check the number and the bank, then try again.'
      );
    }
    throw err;
  }
}

// ── transfers (money out) ───────────────────────────────────────────

type RecipientResponse = { status: boolean; data: { recipient_code: string; active: boolean } };
type TransferData = {
  transfer_code: string;
  reference: string;
  /** pending | otp | success | failed | reversed | abandoned */
  status: string;
  amount: number;
  reason?: string | null;
};
type TransferResponse = { status: boolean; data: TransferData };
type BalanceResponse = { status: boolean; data: { currency: string; balance: number }[] };

/**
 * Registers a payout destination with Paystack and returns its handle.
 *
 * Cached on the rider afterwards. Paystack deduplicates identical recipients,
 * but creating one per payout is a wasted round trip on the path where mistakes
 * are least recoverable.
 */
export async function createTransferRecipient(params: {
  name: string;
  accountNumber: string;
  bankCode: string;
}) {
  const body = await paystackFetch<RecipientResponse>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: 'nuban',
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: 'NGN',
    }),
  });

  return body.data.recipient_code;
}

/**
 * Sends money.
 *
 * `reference` is ours and must be the Payout's. Paystack rejects a duplicate,
 * which makes a retry of this call safe: the second attempt is refused by the
 * provider rather than paying twice.
 */
export async function initiateTransfer(params: {
  amountKobo: number;
  recipientCode: string;
  reference: string;
  reason: string;
}): Promise<TransferData> {
  const body = await paystackFetch<TransferResponse>('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason,
      currency: 'NGN',
    }),
  });

  return body.data;
}

/** Asks Paystack what became of a transfer. The fallback when a webhook is lost. */
export async function verifyTransfer(reference: string): Promise<TransferData> {
  const body = await paystackFetch<TransferResponse>(
    `/transfer/verify/${encodeURIComponent(reference)}`
  );
  return body.data;
}

/**
 * What is actually available to send, in kobo.
 *
 * Checked before initiating so an underfunded account produces "your Paystack
 * balance is ₦X, this payout needs ₦Y" instead of a provider error that reads
 * like the integration is broken.
 */
export async function fetchAvailableBalanceKobo(): Promise<number> {
  const body = await paystackFetch<BalanceResponse>('/balance');
  return body.data.find((b) => b.currency === 'NGN')?.balance ?? 0;
}

export function assertPaidInFull(paidKobo: number, expectedKobo: number) {
  if (paidKobo < expectedKobo) {
    throw badRequest('The amount paid is less than the order total.');
  }
}
