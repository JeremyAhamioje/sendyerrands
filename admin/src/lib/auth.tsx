import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { api, setToken, getToken } from '@/lib/api';
import type { Admin } from '@/lib/types';

const ADMIN_KEY = 'sendy.admin.profile';

type AuthValue = {
  admin: Admin | null;
  signedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * The admin profile is cached alongside the token so a refresh doesn't flash the
 * login screen. The token remains the only thing that grants access — the API
 * re-checks it on every request, so a tampered cache buys nothing.
 */
function readCachedAdmin(): Admin | null {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? (JSON.parse(raw) as Admin) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(() => (getToken() ? readCachedAdmin() : null));

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api<{ token: string; admin: Admin }>('/admin/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setToken(result.token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(result.admin));
    setAdmin(result.admin);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    localStorage.removeItem(ADMIN_KEY);
    setAdmin(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ admin, signedIn: Boolean(admin), signIn, signOut }),
    [admin, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
