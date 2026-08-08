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

  // Restore a stored token on launch and confirm it is still valid.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadSession();
        if (!stored || cancelled) return;
        await authApi.session(stored.token); // 401s if expired
        if (cancelled) return;
        setToken(stored.token);
        setActor(stored.actor);
      } catch (err) {
        // Expired or revoked — drop it rather than leaving a dead token around.
        if (err instanceof ApiError && err.isAuthError) await clearSession();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      // Switching vendors replaces the cart — Sendy dispatches one rider to one
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
