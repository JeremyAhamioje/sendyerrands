import { api } from './client';
import type { ApiBid, ApiOrder, ApiProduct, ApiRiderJob, ApiVendor } from './mappers';

/**
 * One function per endpoint. Thin on purpose — mapping to UI shapes happens in
 * the hooks, so these stay a faithful mirror of the API surface.
 */

// ── auth ────────────────────────────────────────────────────
export type OtpRequestResult = { phone: string; expiresInSeconds: number; devCode?: string };
export type Session = {
  token: string;
  isNewAccount: boolean;
  user?: ApiUser;
  rider?: ApiRider;
  vendor?: ApiVendorSession;
  needsProfile?: boolean;
};

export type ApiUser = {
  id: string; phone: string; firstName: string; lastName: string;
  email: string | null; walletBalanceKobo: number; referralCode: string;
};

export type ApiRider = {
  id: string; phone: string; firstName: string; lastName: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  isOnline: boolean; rating?: number;
  bankCode?: string | null; bankAccountNo?: string | null;
  bankName?: string | null; bankAccountName?: string | null;
};

export type Bank = { name: string; code: string; slug: string };

export type PayoutAccount = {
  bankCode: string | null; bankAccountNo: string | null;
  bankName: string | null; bankAccountName: string | null;
};

export type ApiVendorSession = {
  id: string; name: string; slug: string; phone: string | null;
  isVerified: boolean; isOpen: boolean;
};

export type ApiAddress = {
  id: string; label: string; line1: string; line2: string | null;
  city: string; landmark: string | null; contact: string; phone: string; isDefault: boolean;
};

export const authApi = {
  requestOtp: (phone: string, role: 'customer' | 'rider' | 'vendor' = 'customer') =>
    api.post<OtpRequestResult>('/auth/otp/request', { phone, role }),

  verifyOtp: (input: {
    phone: string; code: string; role?: 'customer' | 'rider' | 'vendor';
    firstName?: string; lastName?: string; email?: string; referredByCode?: string;
    vehicleType?: 'MOTORBIKE' | 'BICYCLE' | 'TRICYCLE' | 'CAR' | 'VAN' | 'FOOT';
    plateNumber?: string;
  }) => api.post<Session>('/auth/otp/verify', input),

  session: (token: string) =>
    api.get<{ actor: 'customer' | 'rider' | 'vendor'; user?: ApiUser; rider?: ApiRider; vendor?: ApiVendorSession }>(
      '/auth/session',
      token
    ),
};

// ── customer ────────────────────────────────────────────────
export const meApi = {
  get: (token: string) => api.get<ApiUser>('/me', token),
  update: (body: Partial<Pick<ApiUser, 'firstName' | 'lastName' | 'email'>>, token: string) =>
    api.patch<ApiUser>('/me', body, token),
  addresses: (token: string) => api.get<ApiAddress[]>('/me/addresses', token),
  addAddress: (body: Omit<ApiAddress, 'id'>, token: string) =>
    api.post<ApiAddress>('/me/addresses', body, token),
  favourites: (token: string) => api.get<ApiVendor[]>('/me/favourites', token),
  saveVendor: (vendorId: string, token: string) =>
    api.put<{ vendorId: string; saved: boolean }>(`/me/favourites/${vendorId}`, {}, token),
  unsaveVendor: (vendorId: string, token: string) =>
    api.del<{ vendorId: string; saved: boolean }>(`/me/favourites/${vendorId}`, token),

  wallet: (token: string) =>
    api.get<{ balanceKobo: number; transactions: WalletTxn[] }>('/me/wallet', token),
};

export type WalletTxn = {
  id: string; type: string; amountKobo: number; balanceKobo: number;
  description: string; createdAt: string;
};

export type VendorApplicationBody = {
  businessName: string;
  category: string;
  area: string;
  state?: string;
  phone: string;
  address?: string;
  contactName?: string;
};

export type ApiVendorApplication = {
  id: string;
  businessName: string;
  category: string;
  area: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export const vendorApplicationsApi = {
  submit: (body: VendorApplicationBody, token: string) =>
    api.post<ApiVendorApplication>('/vendor-applications', body, token),
  mine: (token: string) => api.get<ApiVendorApplication[]>('/vendor-applications/mine', token),
};

export const vendorsApi = {
  list: (params: { q?: string; openOnly?: boolean; sort?: string; limit?: number } = {}, token?: string | null) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
    ).toString();
    return api.get<ApiVendor[]>(`/vendors${qs ? `?${qs}` : ''}`, token);
  },
  detail: (slug: string, token?: string | null) => api.get<ApiVendor>(`/vendors/${slug}`, token),
};

export const ordersApi = {
  create: (
    body: { vendorId: string; addressId: string; items: { productId: string; quantity: number; note?: string }[] },
    token: string
  ) => api.post<ApiOrder>('/orders', body, token),

  createErrand: (body: Record<string, unknown>, token: string) =>
    api.post<ApiOrder>('/orders/errand', body, token),

  createPackage: (body: Record<string, unknown>, token: string) =>
    api.post<ApiOrder>('/orders/package', body, token),

  list: (status: 'active' | 'history' | 'all', token: string) =>
    api.get<ApiOrder[]>(`/orders?status=${status}`, token),

  detail: (id: string, token: string) => api.get<ApiOrder>(`/orders/${id}`, token),

  cancel: (id: string, reason: string | undefined, token: string) =>
    api.post<ApiOrder>(`/orders/${id}/cancel`, { reason }, token),
};

export const paymentsApi = {
  checkout: (orderId: string, method: 'WALLET' | 'PAYSTACK', callbackUrl: string, token: string) =>
    api.post<{ method: string; status: string; walletBalanceKobo?: number; authorizationUrl?: string; reference?: string }>(
      '/payments/checkout',
      { orderId, method, callbackUrl },
      token
    ),
  verify: (reference: string, token: string) =>
    api.post<{ status: string; orderId: string }>('/payments/verify', { reference }, token),

  topup: (amountKobo: number, callbackUrl: string, token: string) =>
    api.post<{ authorizationUrl: string; reference: string }>(
      '/payments/wallet/topup',
      { amountKobo, callbackUrl },
      token
    ),

  /** Settles a top-up once the payment sheet closes. Safe to call repeatedly. */
  verifyTopup: (reference: string, token: string) =>
    api.post<TopupResult>('/payments/wallet/verify', { reference }, token),
};

export type TopupResult = {
  status: 'SUCCESS' | 'FAILED' | 'ABANDONED';
  creditedKobo: number;
  balanceKobo: number;
};

export const marketplaceApi = {
  products: (q: string | undefined, state: string | undefined, token?: string | null) => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (state && state !== 'All') qs.set('state', state);
    return api.get<ApiProduct[]>(`/marketplace/products${qs.toString() ? `?${qs}` : ''}`, token);
  },

  /**
   * One product for the item screen. Serves both a vendor's menu item and a
   * marketplace listing, so it is not filtered to `isMarketplace`.
   */
  product: (id: string, token?: string | null) =>
    api.get<ApiProduct>(`/marketplace/products/${id}`, token),

  requests: (token: string) =>
    api.get<(MarketplaceRequest & { _count: { bids: number } })[]>('/marketplace/requests', token),

  createRequest: (body: Record<string, unknown>, token: string) =>
    api.post<MarketplaceRequest>('/marketplace/requests', body, token),

  requestDetail: (id: string, sort: 'price' | 'eta' | 'rating', token: string) =>
    api.get<MarketplaceRequest & { bids: ApiBid[]; isOpen: boolean }>(
      `/marketplace/requests/${id}?sort=${sort}`,
      token
    ),

  selectBid: (requestId: string, bidId: string, token: string) =>
    api.post<ApiOrder>(`/marketplace/requests/${requestId}/select`, { bidId }, token),
};

export type MarketplaceRequest = {
  id: string; title: string; details: string | null; quantity: number;
  budgetKobo: number | null; dropoffArea: string; status: string; closesAt: string;
};

// ── rider ───────────────────────────────────────────────────
export const riderApi = {
  me: (token: string) =>
    api.get<ApiRider & { today: { earningsKobo: number; trips: number }; zone: string | null; plateNumber: string | null; vehicleType: string | null; completedJobs: number }>(
      '/rider/me',
      token
    ),

  setAvailability: (isOnline: boolean, token: string) =>
    api.patch<{ id: string; isOnline: boolean }>('/rider/availability', { isOnline }, token),

  banks: (token: string) => api.get<Bank[]>('/rider/banks', token),

  /** Asks the bank who owns an account, without storing anything. */
  resolveAccount: (bankCode: string, accountNumber: string, token: string) =>
    api.post<{ accountNumber: string; accountName: string }>(
      '/rider/payout-account/resolve',
      { bankCode, accountNumber },
      token
    ),

  savePayoutAccount: (bankCode: string, accountNumber: string, token: string) =>
    api.put<PayoutAccount>('/rider/payout-account', { bankCode, accountNumber }, token),

  jobs: (sort: 'nearest' | 'payout', token: string) =>
    api.get<ApiRiderJob[]>(`/rider/jobs?sort=${sort}`, token),

  job: (id: string, token: string) => api.get<ApiRiderJob & ApiOrder>(`/rider/jobs/${id}`, token),

  accept: (id: string, token: string) => api.post<ApiOrder>(`/rider/jobs/${id}/accept`, {}, token),

  active: (token: string) => api.get<(ApiRiderJob & ApiOrder) | null>('/rider/active', token),

  /** Jobs this rider accepted — the open board is `jobs` above. */
  orders: (status: 'active' | 'completed' | 'all', token: string) =>
    api.get<ApiRiderJob[]>(`/rider/orders?status=${status}`, token),

  updateStatus: (
    id: string,
    body: { status: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED'; deliveryCode?: string; proofUrl?: string },
    token: string
  ) => api.post<ApiOrder>(`/rider/jobs/${id}/status`, body, token),

  earnings: (range: 'today' | 'week' | 'month', token: string) =>
    api.get<{
      availableKobo: number; payableKobo: number; heldKobo: number;
      holdHours: number; minimumKobo: number;
      totalKobo: number; trips: number; rating: number;
      series: { day: string; valueKobo: number }[];
      earnings: { id: string; grossKobo: number; commissionKobo: number; netKobo: number; createdAt: string }[];
    }>(`/rider/earnings?range=${range}`, token),

  payouts: (token: string) => api.get<ApiPayout[]>('/rider/payouts', token),
};

export type ApiPayout = {
  id: string;
  amountKobo: number;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  reference: string;
  bankName: string | null;
  bankAccountNo: string | null;
  failureReason: string | null;
  createdAt: string;
  settledAt: string | null;
};

export const uploadsApi = {
  signature: (folder: string, token: string) =>
    api.post<{ signature: string; timestamp: number; folder: string; apiKey: string; cloudName: string; uploadUrl: string }>(
      '/uploads/signature',
      { folder },
      token
    ),
};

// ── vendor ──────────────────────────────────────────────────
export type ApiVendorProduct = {
  id: string;
  name: string;
  description: string | null;
  priceKobo: number;
  section: string | null;
  badge: string | null;
  imageUrl: string | null;
  isMarketplace: boolean;
  inStock: boolean;
  _count: { orderItems: number };
};

export type VendorProductBody = {
  name: string;
  description?: string;
  priceKobo: number;
  section?: string;
  imageUrl?: string;
  isMarketplace?: boolean;
  inStock?: boolean;
};

export type ApiVendorMe = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  area: string | null;
  isVerified: boolean;
  isOpen: boolean;
  rating: number;
  _count: { products: number; orders: number };
  today: { salesKobo: number; orders: number };
  awaitingAcceptance: number;
};

export const vendorApi = {
  me: (token: string) => api.get<ApiVendorMe>('/vendor/me', token),

  setOpen: (isOpen: boolean, token: string) =>
    api.patch<{ id: string; isOpen: boolean }>('/vendor/me', { isOpen }, token),

  products: (token: string) => api.get<ApiVendorProduct[]>('/vendor/products', token),

  createProduct: (body: VendorProductBody, token: string) =>
    api.post<ApiVendorProduct>('/vendor/products', body, token),

  updateProduct: (id: string, body: Partial<VendorProductBody>, token: string) =>
    api.patch<ApiVendorProduct>(`/vendor/products/${id}`, body, token),

  deleteProduct: (id: string, token: string) =>
    api.del<{ id: string; name: string }>(`/vendor/products/${id}`, token),

  orders: (status: 'new' | 'active' | 'history' | 'all', token: string) =>
    api.get<ApiVendorOrder[]>(`/vendor/orders?status=${status}`, token),

  acceptOrder: (id: string, token: string) =>
    api.post<ApiOrder>(`/vendor/orders/${id}/accept`, {}, token),

  rejectOrder: (id: string, reason: string | undefined, token: string) =>
    api.post<ApiOrder>(`/vendor/orders/${id}/reject`, { reason }, token),
};

export type ApiVendorOrder = {
  id: string;
  reference: string;
  status: string;
  subtotalKobo: number;
  totalKobo: number;
  createdAt: string;
  items: { id: string; name: string; quantity: number; unitPriceKobo: number; note: string | null }[];
  customer: { firstName: string; lastName: string; phone: string } | null;
  address: { line1: string; city: string; landmark: string | null } | null;
  rider: { firstName: string; lastName: string; phone: string } | null;
};
