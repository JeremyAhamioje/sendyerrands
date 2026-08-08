import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ImagePickerAsset } from 'expo-image-picker';

import { useApp } from '@/store/app';

import { uploadImage, type UploadFolder } from './uploads';

import {
  marketplaceApi, meApi, ordersApi, paymentsApi, riderApi, vendorApplicationsApi, vendorsApi,
} from './endpoints';
import type { VendorApplicationBody } from './endpoints';
import {
  koboToNaira, toBid, toMenuItem, toOrder, toProduct, toRiderJob, toVendor,
} from './mappers';

/**
 * Screens use these, never the raw endpoints — every hook returns data already
 * mapped into the shapes the components render (naira, not kobo; `thumb`, not
 * `imageUrl`).
 */

// ── customer: discovery ─────────────────────────────────────

export function useVendors(params: { q?: string; openOnly?: boolean; sort?: string } = {}) {
  const { token } = useApp();
  return useQuery({
    queryKey: ['vendors', params],
    queryFn: async () => (await vendorsApi.list(params, token)).map(toVendor),
  });
}

export function useVendor(slug: string | undefined) {
  const { token } = useApp();
  return useQuery({
    queryKey: ['vendor', slug],
    queryFn: async () => {
      const v = await vendorsApi.detail(slug!, token);
      return {
        vendor: toVendor(v),
        menu: (v.products ?? []).map(toMenuItem),
        sections: v.sections ?? [],
        // The raw id is what POST /orders needs; the UI shows the slug.
        vendorId: v.id,
        freeOverKobo: v.freeOverKobo,
        deliveryFeeKobo: v.deliveryFeeKobo,
      };
    },
    enabled: Boolean(slug),
  });
}

export function useMarketplaceProducts(q?: string) {
  const { token } = useApp();
  return useQuery({
    queryKey: ['marketplace-products', q],
    queryFn: async () => (await marketplaceApi.products(q, token)).map(toProduct),
  });
}

/**
 * One product for the item screen.
 *
 * Returns the mapped product plus the bits the screen needs that `Product`
 * doesn't carry — the description, and the vendor's id/slug so "add to cart"
 * knows which vendor the order belongs to.
 */
export function useProduct(id: string | undefined) {
  const { token } = useApp();
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const p = await marketplaceApi.product(id!, token);
      return {
        ...toProduct(p),
        description: p.description ?? '',
        section: p.section,
        badge: p.badge,
        vendorId: p.vendorId,
        vendorSlug: p.vendor?.slug ?? null,
        vendorVerified: p.vendor?.isVerified ?? false,
        vendorOpen: p.vendor?.isOpen ?? true,
        etaMin: p.vendor?.etaMinMinutes ?? null,
        etaMax: p.vendor?.etaMaxMinutes ?? null,
        deliveryFee: p.vendor?.deliveryFeeKobo != null ? koboToNaira(p.vendor.deliveryFeeKobo) : null,
        freeOver: p.vendor?.freeOverKobo ? koboToNaira(p.vendor.freeOverKobo) : undefined,
      };
    },
    enabled: Boolean(id),
  });
}

// ── customer: orders ────────────────────────────────────────

export function useOrders(status: 'active' | 'history' | 'all' = 'all') {
  const { token } = useApp();
  return useQuery({
    queryKey: ['orders', status],
    queryFn: async () => (await ordersApi.list(status, token!)).map(toOrder),
    enabled: Boolean(token),
  });
}

export function useOrder(id: string | undefined) {
  const { token } = useApp();
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const o = await ordersApi.detail(id!, token!);
      return {
        order: toOrder(o),
        raw: o,
        stepper: o.stepper ?? [],
        rider: o.rider,
        deliveryCode: o.deliveryCode,
        totals: {
          subtotal: koboToNaira(o.subtotalKobo),
          deliveryFee: koboToNaira(o.deliveryFeeKobo),
          serviceFee: koboToNaira(o.serviceFeeKobo),
          discount: koboToNaira(o.discountKobo),
          total: koboToNaira(o.totalKobo),
        },
        items: (o.items ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: koboToNaira(i.unitPriceKobo ?? 0),
          note: i.note ?? undefined,
        })),
      };
    },
    enabled: Boolean(id && token),
    // An in-flight delivery changes underneath the customer.
    refetchInterval: (query) =>
      query.state.data?.order.status === 'active' ? 15_000 : false,
  });
}

export function useCreateOrder() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { vendorId: string; addressId: string; items: { productId: string; quantity: number; note?: string }[] }) =>
      ordersApi.create(body, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export type NewAddress = {
  label: string;
  line1: string;
  line2?: string;
  city?: string;
  landmark?: string;
  contact: string;
  phone: string;
  isDefault?: boolean;
};

/**
 * Adds a drop-off address. Invalidates `['addresses']`, which is the key the
 * app store loads from, so the new address appears everywhere at once.
 */
export function useAddAddress() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewAddress) =>
      meApi.addAddress(body as unknown as Parameters<typeof meApi.addAddress>[0], token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

/**
 * Errand and package orders skip the cart entirely — they are described in one
 * form and priced by the server, so these post the whole thing in one call.
 * Money goes up as **kobo**, like everywhere else on the wire.
 */
export type ErrandBody = {
  addressId: string;
  task: string;
  details?: string;
  pickupName: string;
  pickupAddress: string;
  budgetKobo?: number;
  photoUrls?: string[];
};

export function useCreateErrand() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ErrandBody) => ordersApi.createErrand(body, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export type PackageBody = {
  pickupName: string;
  pickupAddress: string;
  pickupPhone?: string;
  dropoffName: string;
  dropoffAddress: string;
  dropoffPhone: string;
  size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';
  contents?: string;
  isFragile?: boolean;
  notes?: string;
  addressId?: string;
};

export function useCreatePackage() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PackageBody) => ordersApi.createPackage(body, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useCheckout() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, method }: { orderId: string; method: 'WALLET' | 'PAYSTACK' }) =>
      paymentsApi.checkout(orderId, method, token!),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      // Paying moves the order off PENDING_PAYMENT — the tracking screen reads
      // this key and would otherwise keep offering the pay button.
      qc.invalidateQueries({ queryKey: ['order', v.orderId] });
      qc.invalidateQueries({ queryKey: ['me'] }); // wallet balance moved
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

export function useCancelOrder() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => ordersApi.cancel(id, reason, token!),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', v.id] });
    },
  });
}

// ── customer: account ───────────────────────────────────────

export function useWallet() {
  const { token } = useApp();
  return useQuery({
    queryKey: ['wallet', token],
    queryFn: async () => {
      const w = await meApi.wallet(token!);
      return {
        balance: koboToNaira(w.balanceKobo),
        transactions: w.transactions.map((t) => ({
          ...t,
          amount: koboToNaira(t.amountKobo),
          balance: koboToNaira(t.balanceKobo),
        })),
      };
    },
    enabled: Boolean(token),
  });
}

// ── marketplace / bidding ───────────────────────────────────

export function useMarketplaceRequests() {
  const { token } = useApp();
  return useQuery({
    queryKey: ['marketplace-requests'],
    queryFn: () => marketplaceApi.requests(token!),
    enabled: Boolean(token),
  });
}

export function useBidRequest(id: string | undefined, sort: 'price' | 'eta' | 'rating') {
  const { token } = useApp();
  return useQuery({
    queryKey: ['bid-request', id, sort],
    queryFn: async () => {
      const r = await marketplaceApi.requestDetail(id!, sort, token!);
      return {
        request: {
          id: r.id,
          title: r.title,
          quantity: r.quantity,
          budget: koboToNaira(r.budgetKobo),
          dropoff: r.dropoffArea,
          closesAt: r.closesAt,
          bidCount: r.bids.length,
        },
        bids: r.bids.map(toBid),
        isOpen: r.isOpen,
      };
    },
    enabled: Boolean(id && token),
    // Bids arrive while the customer is watching.
    refetchInterval: (query) => (query.state.data?.isOpen ? 10_000 : false),
  });
}

export function usePostRequest() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => marketplaceApi.createRequest(body, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace-requests'] }),
  });
}

export function useSelectBid() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, bidId }: { requestId: string; bidId: string }) =>
      marketplaceApi.selectBid(requestId, bidId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bid-request'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// ── rider ───────────────────────────────────────────────────

export function useRiderMe() {
  const { token } = useApp();
  return useQuery({
    queryKey: ['rider-me'],
    queryFn: async () => {
      const r = await riderApi.me(token!);
      return { ...r, todayEarnings: koboToNaira(r.today.earningsKobo), todayTrips: r.today.trips };
    },
    enabled: Boolean(token),
  });
}

export function useRiderJobs(sort: 'nearest' | 'payout' = 'nearest') {
  const { token } = useApp();
  return useQuery({
    queryKey: ['rider-jobs', sort],
    queryFn: async () => (await riderApi.jobs(sort, token!)).map(toRiderJob),
    enabled: Boolean(token),
    refetchInterval: 20_000, // the board moves as other riders claim work
  });
}

export function useRiderActive() {
  const { token } = useApp();
  return useQuery({
    queryKey: ['rider-active'],
    queryFn: async () => {
      const j = await riderApi.active(token!);
      return j ? { job: toRiderJob(j), raw: j } : null;
    },
    enabled: Boolean(token),
  });
}

export function useAcceptJob() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => riderApi.accept(id, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rider-jobs'] });
      qc.invalidateQueries({ queryKey: ['rider-active'] });
    },
  });
}

export function useUpdateJobStatus() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED'; deliveryCode?: string; proofUrl?: string }) =>
      riderApi.updateStatus(id, body, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rider-active'] });
      qc.invalidateQueries({ queryKey: ['rider-earnings'] });
      qc.invalidateQueries({ queryKey: ['rider-me'] });
    },
  });
}

export function useSetAvailability() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isOnline: boolean) => riderApi.setAvailability(isOnline, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rider-me'] });
      qc.invalidateQueries({ queryKey: ['rider-jobs'] });
    },
  });
}

export function useRiderEarnings(range: 'today' | 'week' | 'month' = 'week') {
  const { token } = useApp();
  return useQuery({
    queryKey: ['rider-earnings', range],
    queryFn: async () => {
      const e = await riderApi.earnings(range, token!);
      return {
        available: koboToNaira(e.availableKobo),
        total: koboToNaira(e.totalKobo),
        trips: e.trips,
        rating: e.rating,
        week: e.series.map((s) => ({
          day: new Date(s.day).toLocaleDateString('en-NG', { weekday: 'short' }),
          value: koboToNaira(s.valueKobo),
        })),
      };
    },
    enabled: Boolean(token),
  });
}

// ── customer: selling on Sendy ──────────────────────────────

export function useMyVendorApplications() {
  const { token } = useApp();
  return useQuery({
    queryKey: ['vendor-applications'],
    queryFn: () => vendorApplicationsApi.mine(token!),
    enabled: Boolean(token),
  });
}

export function useApplyToSell() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VendorApplicationBody) => vendorApplicationsApi.submit(body, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-applications'] }),
  });
}

// ── customer: marketplace requests ──────────────────────────

/**
 * Posts a request for vendors to bid on.
 *
 * `photoUrls` are already-uploaded Cloudinary URLs — the screen uploads while
 * the customer is still typing, so submitting is one fast call rather than a
 * multi-megabyte one.
 */
export function useCreateRequest() {
  const { token } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      details?: string;
      quantity: number;
      budgetKobo?: number;
      dropoffArea: string;
      addressId?: string;
      photoUrls?: string[];
      bidWindowMinutes?: number;
    }) => marketplaceApi.createRequest(body, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });
}

export function useUploadImage(folder: UploadFolder) {
  const { token } = useApp();
  return useMutation({
    mutationFn: (asset: ImagePickerAsset) => uploadImage(asset, folder, token!),
  });
}
