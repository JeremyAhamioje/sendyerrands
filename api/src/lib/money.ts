import { env } from '@/config/env';

// Everything on the wire and in the database is kobo (integers).
// Formatting to "₦4,500" is the client's job — this module only does maths.

export const nairaToKobo = (naira: number) => Math.round(naira * 100);
export const koboToNaira = (kobo: number) => kobo / 100;

/** Human-readable, for SMS copy and receipts. */
export const formatNaira = (kobo: number) =>
  `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;

export type OrderTotals = {
  subtotalKobo: number;
  /** What the CUSTOMER is charged for delivery — 0 when a promo waives it. */
  deliveryFeeKobo: number;
  serviceFeeKobo: number;
  discountKobo: number;
  totalKobo: number;
  /** What the RIDER earns — always based on the true cost of the trip. */
  riderPayoutKobo: number;
};

/**
 * Single source of truth for what an order costs.
 *
 * The client computes its own preview for display, but the server recomputes
 * here and charges its own number — a client is never trusted with a total.
 */
export function computeTotals(input: {
  subtotalKobo: number;
  deliveryFeeKobo?: number;
  serviceFeeKobo?: number;
  discountKobo?: number;
  /** Vendor's free-delivery threshold, when the order qualifies. */
  freeOverKobo?: number | null;
}): OrderTotals {
  const subtotalKobo = Math.max(0, Math.round(input.subtotalKobo));

  // The true cost of the trip. The rider is paid from THIS, always.
  const baseDeliveryFeeKobo = input.deliveryFeeKobo ?? env.DEFAULT_DELIVERY_FEE_KOBO;

  // A "free delivery over ₦X" promo waives what the CUSTOMER pays. Sendy Errands
  // absorbs it — it is never taken out of the rider's earnings, or riders get
  // paid nothing for exactly the large orders that take the most effort.
  const qualifiesForFreeDelivery = Boolean(input.freeOverKobo && subtotalKobo >= input.freeOverKobo);
  const deliveryFeeKobo = qualifiesForFreeDelivery ? 0 : baseDeliveryFeeKobo;

  const serviceFeeKobo = input.serviceFeeKobo ?? env.SERVICE_FEE_KOBO;
  const discountKobo = Math.max(0, Math.round(input.discountKobo ?? 0));

  // Never let a discount produce a negative charge.
  const gross = subtotalKobo + deliveryFeeKobo + serviceFeeKobo;
  const totalKobo = Math.max(0, gross - discountKobo);

  return {
    subtotalKobo,
    deliveryFeeKobo,
    serviceFeeKobo,
    discountKobo,
    totalKobo,
    riderPayoutKobo: riderPayout(baseDeliveryFeeKobo),
  };
}

/** Sendy Errands takes PLATFORM_COMMISSION_BPS of the delivery fee; the rider keeps the rest. */
export function riderPayout(deliveryFeeKobo: number): number {
  const commission = Math.round((deliveryFeeKobo * env.PLATFORM_COMMISSION_BPS) / 10_000);
  return Math.max(0, deliveryFeeKobo - commission);
}

export function commissionOn(deliveryFeeKobo: number): number {
  return deliveryFeeKobo - riderPayout(deliveryFeeKobo);
}

/**
 * Reverses `riderPayout` — recovers the gross trip value from what the rider
 * earns. Needed when booking earnings, because the fee CHARGED can be 0 under a
 * free-delivery promo while the rider is still owed their full cut.
 */
export function grossFromPayout(payoutKobo: number): { grossKobo: number; commissionKobo: number } {
  const bps = env.PLATFORM_COMMISSION_BPS;
  if (bps <= 0 || bps >= 10_000) return { grossKobo: payoutKobo, commissionKobo: 0 };

  const grossKobo = Math.round((payoutKobo * 10_000) / (10_000 - bps));
  return { grossKobo, commissionKobo: grossKobo - payoutKobo };
}
