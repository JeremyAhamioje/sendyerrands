import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Token persistence.
 *
 * expo-secure-store uses the iOS Keychain / Android Keystore, which is where an
 * auth token belongs. It has no web implementation, so the web build falls back
 * to localStorage — acceptable because web is our development/demo surface, not
 * a shipping target.
 */

const TOKEN_KEY = 'sendy.auth.token';
const ACTOR_KEY = 'sendy.auth.actor';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string) {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export type Actor = 'customer' | 'rider' | 'vendor';
export type StoredSession = { token: string; actor: Actor };

const ACTORS: Actor[] = ['customer', 'rider', 'vendor'];

export async function saveSession(session: StoredSession) {
  await Promise.all([setItem(TOKEN_KEY, session.token), setItem(ACTOR_KEY, session.actor)]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [token, actor] = await Promise.all([getItem(TOKEN_KEY), getItem(ACTOR_KEY)]);
  if (!token) return null;

  // Checked against the list rather than `=== 'rider' ? … : 'customer'`, which
  // silently downgraded every restored vendor session to a customer one: the
  // vendor token then 403'd on every customer endpoint and the app told them
  // to sign in again, on every launch, forever.
  return { token, actor: ACTORS.find((a) => a === actor) ?? 'customer' };
}

export async function clearSession() {
  await Promise.all([deleteItem(TOKEN_KEY), deleteItem(ACTOR_KEY)]);
}

/**
 * A top-up that was started but not yet settled.
 *
 * On web the payment happens in the same tab, so the code that started it is
 * gone by the time Paystack redirects back — there is nothing left in memory
 * holding the reference. Parking it here lets the wallet screen pick it up on
 * the next mount and ask the server what happened.
 *
 * Deliberately not cleared until the server gives a definitive answer: losing
 * the reference means losing the only handle on a payment the customer made.
 */
const PENDING_TOPUP_KEY = 'sendy.wallet.pendingTopup';

export async function savePendingTopup(reference: string) {
  await setItem(PENDING_TOPUP_KEY, reference);
}

export async function getPendingTopup(): Promise<string | null> {
  return getItem(PENDING_TOPUP_KEY);
}

export async function clearPendingTopup() {
  await deleteItem(PENDING_TOPUP_KEY);
}

/** The same problem for an order paid by card, which also leaves the app. */
const PENDING_PAYMENT_KEY = 'sendy.order.pendingPayment';

export type PendingPayment = { reference: string; orderId: string };

export async function savePendingPayment(pending: PendingPayment) {
  await setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending));
}

export async function getPendingPayment(): Promise<PendingPayment | null> {
  const raw = await getItem(PENDING_PAYMENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingPayment;
  } catch {
    // Unparseable means nothing recoverable is in there.
    await deleteItem(PENDING_PAYMENT_KEY);
    return null;
  }
}

export async function clearPendingPayment() {
  await deleteItem(PENDING_PAYMENT_KEY);
}

/**
 * The cart, on web only.
 *
 * Paying by card navigates the whole tab away and back, which is a full page
 * load — and the cart lives in React state, so it does not survive one. Neither
 * does an accidental refresh. On native the app stays alive across the payment
 * sheet, so there is nothing to rescue.
 *
 * Web only also sidesteps SecureStore, which is for secrets and caps values at
 * about 2KB on Android. A cart is neither secret nor reliably small.
 */
const CART_KEY = 'sendy.cart';

export function saveCartWeb(json: string) {
  if (isWeb) globalThis.localStorage?.setItem(CART_KEY, json);
}

export function loadCartWeb(): string | null {
  return isWeb ? (globalThis.localStorage?.getItem(CART_KEY) ?? null) : null;
}

export function clearCartWeb() {
  if (isWeb) globalThis.localStorage?.removeItem(CART_KEY);
}
