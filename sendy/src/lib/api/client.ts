import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolves the API base URL.
 *
 * `localhost` only works on web and simulators. On a physical phone running
 * Expo Go, localhost is the PHONE — so we derive the dev machine's LAN IP from
 * the Expo host URI that already got the bundle to the device.
 *
 * Override with EXPO_PUBLIC_API_URL for staging/production builds.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const port = 4000;

  // "192.168.1.20:8081" — the machine serving the bundle is the machine running the API.
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.experienceUrl?.replace(/^\w+:\/\//, '');
  const lanHost = hostUri?.split(':')[0];

  if (lanHost && lanHost !== 'localhost' && lanHost !== '127.0.0.1') {
    return `http://${lanHost}:${port}`;
  }

  // Android emulators reach the host machine through this alias, not localhost.
  if (Platform.OS === 'android') return `http://10.0.2.2:${port}`;

  return `http://localhost:${port}`;
}

export const API_BASE_URL = resolveBaseUrl();
const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when re-authenticating is the fix. */
  get isAuthError() {
    return this.status === 401;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

/** How long to wait before assuming the network is gone. */
const TIMEOUT_MS = 20_000;

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;

  // Compose the caller's signal with our own timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());

  try {
    const res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 204) return undefined as T;

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const err = payload?.error;
      throw new ApiError(
        res.status,
        err?.code ?? 'UNKNOWN',
        err?.message ?? 'Something went wrong. Please try again.',
        err?.details
      );
    }

    // The API wraps every success in { data: … }.
    return (payload?.data ?? payload) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;

    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', "That took too long. Check your connection and try again.");
    }

    // fetch() rejects on DNS/connection failures — the usual case is the API
    // simply not running, which is worth saying plainly during development.
    throw new ApiError(
      0,
      'NETWORK',
      `Can't reach Sendy. Is the API running at ${API_BASE_URL}?`
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { token }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'POST', body, token }),
  patch: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PATCH', body, token }),
  del: <T>(path: string, token?: string | null) => request<T>(path, { method: 'DELETE', token }),
};
