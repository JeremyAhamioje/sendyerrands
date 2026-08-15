/**
 * Interstate parcel pricing and timing.
 *
 * These numbers MIRROR api/src/routes/orders.routes.ts — PARCEL_FEE_KOBO and
 * INTERSTATE_SURCHARGE_KOBO. The server is the authority and recomputes the fee
 * from the states on the request; this copy exists only so the screen can show
 * a total before submitting. If the two ever disagree, the server wins and the
 * customer sees a different figure on the order than the one they agreed to, so
 * change both together.
 */

export type ParcelSizeId = 'small' | 'medium' | 'large' | 'xl';

export const PARCEL_SIZES: {
  id: ParcelSizeId;
  label: string;
  hint: string;
  /** Same-state fee, in naira. */
  local: number;
  /** Crossing a state line, in naira. */
  interstate: number;
}[] = [
  { id: 'small', label: 'Small', hint: 'Fits a bag', local: 1_300, interstate: 4_000 },
  { id: 'medium', label: 'Medium', hint: '≤ 5 kg', local: 1_900, interstate: 6_000 },
  { id: 'large', label: 'Large', hint: '≤ 15 kg', local: 2_800, interstate: 9_000 },
  { id: 'xl', label: 'Extra large', hint: '≤ 30 kg', local: 4_200, interstate: 13_500 },
];

export const PARCEL_TYPES = ['Documents', 'Food', 'Electronics', 'Fragile', 'Clothing', 'Other'];

/** The picker's ids are lowercase; the API's enum is not. */
export const SIZE_ENUM: Record<ParcelSizeId, 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE'> = {
  small: 'SMALL',
  medium: 'MEDIUM',
  large: 'LARGE',
  xl: 'EXTRA_LARGE',
};

export function crossesStates(origin: string | null, destination: string | null): boolean {
  if (!origin || !destination) return false;
  return origin.trim().toLowerCase() !== destination.trim().toLowerCase();
}

export function parcelPrice(size: ParcelSizeId, interstate: boolean): number {
  const row = PARCEL_SIZES.find((s) => s.id === size) ?? PARCEL_SIZES[0]!;
  return interstate ? row.interstate : row.local;
}

/**
 * What to tell someone about timing.
 *
 * Deliberately a range in days for interstate rather than a delivery date. The
 * app has no carrier integration and no route data, so a specific date would be
 * invented — and an invented date is the one thing a customer will hold you to.
 */
export function parcelEta(interstate: boolean): string {
  return interstate ? '2–4 working days' : 'Same day';
}
