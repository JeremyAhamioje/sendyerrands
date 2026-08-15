import { randomInt } from 'node:crypto';

/** Order reference shown to customers and support: "SND-8841". */
export function orderReference(): string {
  return `SND-${randomInt(1000, 9999)}${randomInt(10, 99)}`;
}

/** 4-digit code the customer reads out to the rider at the door. */
export function deliveryCode(): string {
  return String(randomInt(1000, 9999));
}

/** 6-digit OTP. */
export function otpCode(): string {
  return String(randomInt(100000, 999999));
}

/** Referral code: "SENDY-CHI42". */
/**
 * A referral code, unique per user.
 *
 * The suffix used to be randomInt(10, 99) — ninety possible codes per name
 * stem. Two customers called Chinedu collided better than one time in ninety,
 * and the collision surfaced at signup as a bare unique-constraint violation:
 * "that record already exists", on a form where nothing the person typed was
 * the problem and nothing they could change would fix it.
 *
 * Four characters from an unambiguous alphabet is about 1.7 million per stem.
 * No I/O/1/0 because these get read aloud and typed by the person being
 * referred — the same reason the support password generator avoids them.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function referralCode(firstName: string): string {
  const stem = firstName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'SND';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `SENDY-${stem}${suffix}`;
}

/** Internal payment reference for wallet-funded orders. */
export function paymentReference(prefix = 'SNDY'): string {
  return `${prefix}_${Date.now()}_${randomInt(1000, 9999)}`;
}

/**
 * Normalise Nigerian phone input to E.164.
 * Accepts "08031234567", "8031234567", "+2348031234567", "234 803 123 4567".
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^\d{10}$/.test(digits)) return `+234${digits}`;
  return null;
}
