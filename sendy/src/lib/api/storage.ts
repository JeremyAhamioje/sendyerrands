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
