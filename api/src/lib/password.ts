import bcrypt from 'bcryptjs';

import { badRequest } from './errors';

/**
 * Password hashing and policy.
 *
 * bcrypt at cost 12. The OTP codes elsewhere in this codebase use 10, which is
 * fine for a six-digit secret that dies in ten minutes; a password lives for
 * years and is very often reused on other services, so it earns the extra
 * factor of four. Rehash the world if this ever moves — do not lower it.
 */
const COST = 12;

/**
 * Deliberately not a complexity rule.
 *
 * Requiring an uppercase, a digit and a symbol reliably produces `Password1!`
 * and nothing safer. Length is the property that actually resists guessing, so
 * that is what is enforced, along with a small list of the passwords an
 * attacker tries first. The 72-byte ceiling is bcrypt's own: it silently
 * truncates beyond that, and a silent truncation is worse than a clear error.
 */
const MIN_LENGTH = 10;
const MAX_BYTES = 72;

const TOO_COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd123',
  '1234567890', '12345678910', 'qwertyuiop', 'letmein123', 'iloveyou123',
  'sendy12345', 'sendyerrands', 'administrator', 'welcome123', 'abc123456',
]);

export function assertPasswordAcceptable(password: string) {
  if (password.length < MIN_LENGTH) {
    throw badRequest(`Use at least ${MIN_LENGTH} characters. Length matters more than symbols.`);
  }

  // Byte length, not character length: an emoji or an accented name eats four
  // bytes and would otherwise be truncated without anyone being told.
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
    throw badRequest('That password is too long. Use 72 bytes or fewer.');
  }

  if (TOO_COMMON.has(password.toLowerCase())) {
    throw badRequest('That password is one of the first an attacker would try. Pick another.');
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * A hash of nothing anyone can log in with, compared against when no account
 * exists for a given address.
 *
 * Without it, a sign-in attempt for an unknown address returns in under a
 * millisecond while a known one spends ~250ms in bcrypt. That gap is trivially
 * measurable over a network and turns the login endpoint into a "does this
 * person have a Sendy Errands account?" oracle for anyone with a mailing list.
 * Burning the same time on both paths closes it.
 */
const DUMMY_HASH = bcrypt.hashSync('sendy-errands-no-such-account', COST);

export async function burnTimingBudget(password: string) {
  await bcrypt.compare(password, DUMMY_HASH);
}
