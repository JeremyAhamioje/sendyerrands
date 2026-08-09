import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError } from '@/lib/api/client';
import { authApi, meApi, type ApiAddress, type ApiUser } from '@/lib/api/endpoints';
import { koboToNaira } from '@/lib/api/mappers';
import { clearSession, loadSession, saveSession } from '@/lib/api/storage';
import type { Thumb } from '@/lib/mock';

/**
 * Session + cart.
 *
 * The cart deliberately stays on the device: the API creates an Order only at
 * checkout, from product IDs. Nothing is reserved or priced server-side until
 * the customer commits.
 */

export type CartLine = {
  id: string;
  name: string;
  note?: string;
  price: number; // naira — mappers converted at the API boundary
  qty: number;
  thumb: Thumb;
};

type AppState = {
  // session
  ready: boolean;
  token: string | null;
  signedIn: boolean;
  user: ApiUser | null;
  actor: 'customer' | 'rider' | 'vendor';
  signIn: (token: string, actor?: 'customer' | 'rider' | 'vendor') => Promise<void>;
  signOut: () => Promise<void>;
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;

  // addresses
  addresses: ApiAddress[];
  activeAddress: ApiAddress | null;
  setActiveAddress: (id: string) => void;

  // cart
  cart: CartLine[];
  vendorId: string | null;
  addToCart: (line: Omit<CartLine, 'qty'>, vendorId: string) => void;
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;
  cartCount: number;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  /** Fees for the vendor currently in the cart, so the preview matches checkout. */
  setVendorFees: (fees: { deliveryFee: number; freeOver?: number }) => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [actor, setActor] = useState<'customer' | 'rider' | 'vendor'>('customer');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [cart, setCart] = useState<CartLine[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorFees, setVendorFees] = useState<{ deliveryFee: number; freeOver?: number }>({
    deliveryFee: 1300,
  });
  const [activeAddressId, setActiveAddressId] = useState<string | null>(null);

  /**
   * Restore a stored token on launch.
   *
   * The stored token is trusted immediately and verified in the background,
   * rather than the other way round.
   *
   * Verifying first meant a single slow `/auth/session` call decided whether
   * the user was signed in, and *every* failure — timeout, DNS, 502 — looked
   * identical to an expired token: the app fell through to onboarding with a
   * perfectly good token still sitting in SecureStore. On Render's free tier
   * the API sleeps after 15 minutes and the first request takes ~25s to wake
   * it, past the client's abort. So anyone who opened the app less often than
   * every 15 minutes was signed out on roughly every launch, while whoever was
   * using it constantly never saw it once.
   *
   * A JWT is self-contained and lasts 30 days. There is nothing to ask the
   * server for at launch: if the token really is dead, the next authenticated
   * request returns 401 and QueryError offers signing in again.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // A SecureStore read can itself throw (keystore reset, restored backup).
      // That is a real signed-out state; anything else is not.
      const stored = await loadSession().catch(() => null);
      if (cancelled) return;

      if (stored) {
        setToken(stored.token);
        setActor(stored.actor);
      }
      setReady(true);
      if (!stored) return;

      try {
        // Also the authoritative answer on actor, which matters when the stored
        // value is older than the app's understanding of the roles.
        const session = await authApi.session(stored.token);
        if (!cancelled) setActor(session.actor);
      } catch (err) {
        // ONLY 401 means the token is dead. A timeout or a 5xx means the API
        // was asleep or unreachable, which the user cannot fix by signing in.
        if (cancelled || !(err instanceof ApiError) || !err.isAuthError) return;
        await clearSession();
        setToken(null);
        setActor('customer');
        queryClient.clear();
      }
    })();
    return () => {
      cancelled = true;
    };
    // queryClient is stable for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: user } = useQuery({
    queryKey: ['me', token],
    queryFn: () => meApi.get(token!),
    enabled: Boolean(token) && actor === 'customer',
  });

  const { data: addresses } = useQuery({
    queryKey: ['addresses', token],
    queryFn: () => meApi.addresses(token!),
    enabled: Boolean(token) && actor === 'customer',
  });

  const signIn = useCallback(
    async (newToken: string, newActor: 'customer' | 'rider' | 'vendor' = 'customer') => {
      await saveSession({ token: newToken, actor: newActor });
      setToken(newToken);
      setActor(newActor);
    },
    []
  );

  const signOut = useCallback(async () => {
    await clearSession();
    setToken(null);
    setCart([]);
    setActiveAddressId(null);
    queryClient.clear();
  }, [queryClient]);

  const addToCart = useCallback((line: Omit<CartLine, 'qty'>, vendor: string) => {
    setCart((prev) => {
      // Switching vendors replaces the cart — Sendy Errands dispatches one rider to one
      // pickup, so a mixed-vendor cart cannot be fulfilled.
      const base = vendor !== vendorIdRef.current && prev.length ? [] : prev;
      vendorIdRef.current = vendor;
      const found = base.find((l) => l.id === line.id);
      if (found) return base.map((l) => (l.id === line.id ? { ...l, qty: l.qty + 1 } : l));
      return [...base, { ...line, qty: 1 }];
    });
    setVendorId(vendor);
  }, []);

  // Kept in a ref so addToCart doesn't need vendorId in its dependency list.
  const vendorIdRef = useMemoRef(vendorId);

  const setQty = useCallback((id: string, qty: number) => {
    setCart((prev) =>
      qty <= 0 ? prev.filter((l) => l.id !== id) : prev.map((l) => (l.id === id ? { ...l, qty } : l))
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const value = useMemo<AppState>(() => {
    const subtotal = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
    const qualifiesFree = Boolean(vendorFees.freeOver && subtotal >= vendorFees.freeOver);
    const deliveryFee = cart.length ? (qualifiesFree ? 0 : vendorFees.deliveryFee) : 0;
    const serviceFee = cart.length ? 300 : 0;
    const discount = 0;

    const list = addresses ?? [];
    const active = list.find((a) => a.id === activeAddressId) ?? list.find((a) => a.isDefault) ?? list[0] ?? null;

    return {
      ready,
      token,
      signedIn: Boolean(token),
      user: user ?? null,
      actor,
      signIn,
      signOut,
      phoneNumber,
      setPhoneNumber,
      addresses: list,
      activeAddress: active,
      setActiveAddress: setActiveAddressId,
      cart,
      vendorId,
      addToCart,
      setQty,
      clearCart,
      cartCount: cart.reduce((n, l) => n + l.qty, 0),
      subtotal,
      deliveryFee,
      serviceFee,
      discount,
      total: Math.max(0, subtotal + deliveryFee + serviceFee - discount),
      setVendorFees,
    };
  }, [
    ready, token, user, actor, signIn, signOut, phoneNumber,
    addresses, activeAddressId, cart, vendorId, addToCart, setQty, clearCart, vendorFees,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Tiny helper: a ref that always mirrors the latest value. */
function useMemoRef<T>(value: T) {
  const ref = useMemo(() => ({ current: value }), []);
  ref.current = value;
  return ref;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** Wallet balance in naira, for display. */
export function useWalletBalance() {
  const { user } = useApp();
  return koboToNaira(user?.walletBalanceKobo);
}
