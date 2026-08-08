/**
 * Shapes returned by the admin API.
 *
 * These mirror `api/prisma/schema.prisma` as the admin routes serialise it —
 * Prisma models are returned whole, so money stays in **kobo integers** and
 * dates arrive as ISO strings. Convert with `naira()` at the render edge; never
 * store naira in state, or a stray value renders 100x wrong.
 */

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'VENDOR_ACCEPTED'
  | 'RIDER_ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type OrderType = 'FOOD' | 'PACKAGE' | 'ERRAND' | 'MARKETPLACE';

export type RiderStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type DocumentStatus = 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export type AdminRole = 'SUPERADMIN' | 'OPERATIONS' | 'SUPPORT';

export type Admin = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
};

export type DashboardStats = {
  ordersToday: number;
  gmvTodayKobo: number;
  activeRiders: number;
  pendingVerifications: number;
  openRequests: number;
  liveOrders: number;
};

export type RiderDocument = {
  id: string;
  type: string;
  fileUrl: string;
  status: DocumentStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
};

export type Rider = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string | null;
  plateNumber: string | null;
  zone: string | null;
  status: RiderStatus;
  isOnline: boolean;
  rating: number;
  completedJobs: number;
  bankName: string | null;
  bankAccountNo: string | null;
  createdAt: string;
  documents: RiderDocument[];
  _count?: { orders: number };
};

export type OrderListItem = {
  id: string;
  reference: string;
  type: OrderType;
  status: OrderStatus;
  totalKobo: number;
  createdAt: string;
  customer: { firstName: string; lastName: string; phone: string } | null;
  rider: { firstName: string; lastName: string; phone: string } | null;
  vendor: { name: string } | null;
};

export type OrderEvent = {
  id: string;
  status: OrderStatus;
  note: string | null;
  actorType: string | null;
  createdAt: string;
};

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPriceKobo: number;
};

export type Payment = {
  id: string;
  method: string;
  status: string;
  amountKobo: number;
  reference: string | null;
  createdAt: string;
};

export type OrderDetail = OrderListItem & {
  subtotalKobo: number;
  deliveryFeeKobo: number;
  serviceFeeKobo: number;
  riderPayoutKobo: number;
  deliveryCode: string | null;
  note: string | null;
  deliveredAt: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    walletBalanceKobo: number;
  } | null;
  rider: (Rider & { id: string }) | null;
  address: {
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    landmark: string | null;
    contact: string;
    phone: string;
  } | null;
  items: OrderItem[];
  events: OrderEvent[];
  payments: Payment[];
  errandDetail: { task: string; budgetKobo: number | null; pickupAddress: string | null } | null;
  packageDetail: { size: string; description: string | null; pickupAddress: string | null } | null;
};

export type Bid = {
  id: string;
  priceKobo: number;
  etaMinutes: number;
  note: string | null;
  status: string;
  vendor: { name: string } | null;
};

export type MarketplaceRequest = {
  id: string;
  title: string;
  description: string | null;
  budgetKobo: number | null;
  status: string;
  closesAt: string;
  createdAt: string;
  customer: { firstName: string; lastName: string; phone: string } | null;
  bids: Bid[];
};

export type Vendor = {
  id: string;
  name: string;
  slug: string;
  tags: string[];
  area: string | null;
  rating: number;
  isVerified: boolean;
  isOpen: boolean;
  canBid: boolean;
  coverUrl: string | null;
  /** Decides whether a vendor may be deleted — one with orders may not. */
  _count: { products: number; orders: number };
};

/** A catalogue listing, as the admin sees it. */
export type AdminProduct = {
  id: string;
  name: string;
  description: string | null;
  priceKobo: number;
  section: string | null;
  badge: string | null;
  imageUrl: string | null;
  isMarketplace: boolean;
  inStock: boolean;
  /** How many past order lines reference this listing. */
  _count: { orderItems: number };
};

export type VendorCatalogue = {
  vendor: { id: string; name: string };
  products: AdminProduct[];
};

export type VendorApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type VendorApplication = {
  id: string;
  businessName: string;
  category: string;
  area: string;
  phone: string;
  address: string | null;
  contactName: string | null;
  note: string | null;
  status: VendorApplicationStatus;
  createdAt: string;
  reviewedAt: string | null;
  applicant: { id: string; firstName: string; lastName: string; phone: string } | null;
  vendor: { id: string; name: string; slug: string } | null;
};
