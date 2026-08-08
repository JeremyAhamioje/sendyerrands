import type { OrderStatus, OrderType, Prisma, PrismaClient } from '@prisma/client';

import { conflict } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { grossFromPayout } from '@/lib/money';

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * The only legal status transitions. Anything else is rejected — this is what
 * stops a rider marking "delivered" on an order that was never picked up, and
 * what keeps the customer's tracking stepper honest.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PLACED', 'CANCELLED'],
  PLACED: ['VENDOR_ACCEPTED', 'RIDER_ASSIGNED', 'CANCELLED'],
  VENDOR_ACCEPTED: ['RIDER_ASSIGNED', 'CANCELLED'],
  RIDER_ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'DELIVERED', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: ['REFUNDED'],
  REFUNDED: [],
};

const LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PLACED: 'Order placed',
  VENDOR_ACCEPTED: 'Vendor accepted',
  RIDER_ASSIGNED: 'Rider assigned',
  PICKED_UP: 'Picked up from vendor',
  IN_TRANSIT: 'On the way to you',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function statusLabel(status: OrderStatus): string {
  return LABELS[status];
}

/** Timestamp columns that mirror the status, for cheap reporting queries. */
function timestampFor(status: OrderStatus): Partial<Prisma.OrderUpdateInput> {
  const now = new Date();
  switch (status) {
    case 'PLACED':
      return { placedAt: now };
    case 'VENDOR_ACCEPTED':
      return { acceptedAt: now };
    case 'RIDER_ASSIGNED':
      return { assignedAt: now };
    case 'PICKED_UP':
      return { pickedUpAt: now };
    case 'DELIVERED':
      return { deliveredAt: now };
    default:
      return {};
  }
}

/**
 * Moves an order to a new status, writing the audit event in the same
 * transaction. On DELIVERED it also books the rider's earning.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  actor: { type: 'customer' | 'rider' | 'vendor' | 'admin' | 'system'; id?: string },
  opts?: { note?: string; extra?: Prisma.OrderUpdateInput; tx?: Tx }
) {
  const run = async (tx: Tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw conflict('That order no longer exists.');

    if (order.status === to) return order; // idempotent — safe to retry

    if (!canTransition(order.status, to)) {
      throw conflict(`An order that is "${LABELS[order.status]}" cannot become "${LABELS[to]}".`);
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: to, ...timestampFor(to), ...opts?.extra },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        status: to,
        label: LABELS[to],
        note: opts?.note,
        actorType: actor.type,
        actorId: actor.id,
      },
    });

    // Book the rider's cut exactly once, when the job actually completes.
    // Derive gross from the PAYOUT, not from deliveryFeeKobo: under a
    // free-delivery promo the customer is charged 0 while the rider is still
    // owed the full amount, and Sendy eats the difference.
    if (to === 'DELIVERED' && updated.riderId) {
      const { grossKobo, commissionKobo } = grossFromPayout(updated.riderPayoutKobo);
      await tx.riderEarning.upsert({
        where: { orderId },
        create: {
          orderId,
          riderId: updated.riderId,
          grossKobo,
          commissionKobo,
          netKobo: updated.riderPayoutKobo,
        },
        update: {},
      });
      await tx.rider.update({
        where: { id: updated.riderId },
        data: { completedJobs: { increment: 1 } },
      });
    }

    return updated;
  };

  return opts?.tx ? run(opts.tx) : prisma.$transaction(run);
}

/**
 * Shape the mobile app's tracking stepper renders from.
 *
 * Two things this has to get right:
 *  - Packages and errands have no vendor, so "Vendor accepted" is dropped
 *    entirely rather than shown as a step that will never complete.
 *  - A step BEFORE the current one counts as done even with no event row.
 *    Orders legitimately skip states (a vendor auto-accepts, an admin assigns
 *    a rider directly), and a stray "pending" node between two ticks reads as
 *    a stalled order to the customer.
 */
export function buildStepper(
  events: { status: OrderStatus; label: string; createdAt: Date }[],
  current: OrderStatus,
  type?: OrderType
) {
  const hasVendor = type !== 'PACKAGE' && type !== 'ERRAND';

  const flow: OrderStatus[] = [
    'PLACED',
    ...(hasVendor ? (['VENDOR_ACCEPTED'] as OrderStatus[]) : []),
    'RIDER_ASSIGNED',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
  ];

  // Pickup copy depends on where the rider actually collects from.
  const label = (status: OrderStatus) =>
    status === 'PICKED_UP' && !hasVendor
      ? type === 'ERRAND'
        ? 'Items collected'
        : 'Picked up from sender'
      : LABELS[status];

  const seen = new Map(events.map((e) => [e.status, e.createdAt]));

  // Terminal states aren't on the happy path — show every step as done//final.
  if (current === 'CANCELLED' || current === 'REFUNDED') {
    return [
      ...flow
        .filter((s) => seen.has(s))
        .map((status) => ({ status, label: label(status), at: seen.get(status) ?? null, state: 'done' as const })),
      { status: current, label: LABELS[current], at: seen.get(current) ?? null, state: 'current' as const },
    ];
  }

  const currentIndex = flow.indexOf(current);

  return flow.map((status, i) => ({
    status,
    label: label(status),
    at: seen.get(status) ?? null,
    state: i < currentIndex ? ('done' as const) : i === currentIndex ? ('current' as const) : ('pending' as const),
  }));
}
