import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  DashboardStats,
  MarketplaceRequest,
  OrderDetail,
  OrderListItem,
  OrderStatus,
  Rider,
  RiderStatus,
  Vendor,
  VendorApplication,
  VendorApplicationStatus,
  VendorCatalogue,
} from '@/lib/types';

/** Ops screens are watched all day, so live counts refresh on their own. */
const LIVE_REFETCH_MS = 30_000;

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardStats>('/admin/dashboard'),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useRiders(status?: RiderStatus | 'ALL') {
  const query = status && status !== 'ALL' ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['riders', status ?? 'ALL'],
    queryFn: () => api<Rider[]>(`/admin/riders${query}`),
  });
}

export function useVerifyRider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: 'APPROVED' | 'REJECTED' | 'SUSPENDED'; note?: string }) =>
      api<Rider>(`/admin/riders/${vars.id}/verify`, {
        method: 'PATCH',
        body: { status: vars.status, ...(vars.note ? { note: vars.note } : {}) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['riders'] });
      // The pending-verification tile on the dashboard just changed.
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useOrders(filters: { status?: string; type?: string; q?: string }) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.type) params.set('type', filters.type);
  if (filters.q) params.set('q', filters.q);
  const suffix = params.toString() ? `?${params}` : '';

  return useQuery({
    queryKey: ['orders', filters.status ?? '', filters.type ?? '', filters.q ?? ''],
    queryFn: () => api<OrderListItem[]>(`/admin/orders${suffix}`),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => api<OrderDetail>(`/admin/orders/${id}`),
    enabled: Boolean(id),
  });
}

/** Everything that mutates an order invalidates the same three views. */
function useOrderMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAssignRider() {
  return useOrderMutation((vars: { orderId: string; riderId: string }) =>
    api(`/admin/orders/${vars.orderId}/assign`, { method: 'POST', body: { riderId: vars.riderId } })
  );
}

export function useSetOrderStatus() {
  return useOrderMutation((vars: { orderId: string; status: OrderStatus; note?: string }) =>
    api(`/admin/orders/${vars.orderId}/status`, {
      method: 'POST',
      body: { status: vars.status, ...(vars.note ? { note: vars.note } : {}) },
    })
  );
}

export function useRefundOrder() {
  return useOrderMutation((vars: { orderId: string; amountKobo?: number; reason?: string }) =>
    api(`/admin/orders/${vars.orderId}/refund`, {
      method: 'POST',
      body: {
        ...(vars.amountKobo ? { amountKobo: vars.amountKobo } : {}),
        ...(vars.reason ? { reason: vars.reason } : {}),
      },
    })
  );
}

export function useRequests(status?: string) {
  const query = status && status !== 'ALL' ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['requests', status ?? 'ALL'],
    queryFn: () => api<MarketplaceRequest[]>(`/admin/requests${query}`),
  });
}

/**
 * The admin list, not the public `GET /vendors` — that one caps `limit` at 50
 * and would quietly hide vendors once the catalogue grows past it.
 */
export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: () => api<Vendor[]>('/admin/vendors'),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; isVerified?: boolean; canBid?: boolean; isOpen?: boolean }) => {
      const { id, ...patch } = vars;
      return api<Vendor>(`/admin/vendors/${id}`, { method: 'PATCH', body: patch });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  });
}

/** A vendor's listings. Only fetched once its row is expanded. */
export function useVendorProducts(vendorId: string | null) {
  return useQuery({
    queryKey: ['vendor-products', vendorId],
    queryFn: () => api<VendorCatalogue>(`/admin/vendors/${vendorId}/products`),
    enabled: vendorId !== null,
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ id: string; name: string; orderItemsUnlinked: number }>(`/admin/products/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-products'] });
      // The vendors table shows a product count, so it goes stale too.
      qc.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ id: string; name: string; productsDeleted: number }>(`/admin/vendors/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ── vendor applications ─────────────────────────────────────

export function useVendorApplications(status?: VendorApplicationStatus) {
  return useQuery({
    queryKey: ['vendor-applications', status ?? 'all'],
    queryFn: () =>
      api<VendorApplication[]>(
        `/admin/vendor-applications${status ? `?status=${status}` : ''}`
      ),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useDecideApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; decision: 'APPROVE' | 'REJECT'; note?: string }) => {
      const { id, ...body } = vars;
      return api<VendorApplication>(`/admin/vendor-applications/${id}/decide`, {
        method: 'POST',
        body,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-applications'] });
      // Approving creates a vendor, so that list is stale too.
      qc.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

export function useInviteVendors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { requestId: string; vendorIds: string[] }) =>
      api<MarketplaceRequest>(`/admin/requests/${vars.requestId}/invite`, {
        method: 'POST',
        body: { vendorIds: vars.vendorIds },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });
}
