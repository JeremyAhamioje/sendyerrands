import { Router } from 'express';
import { z } from 'zod';

import { env } from '@/config/env';
import { badRequest, conflict, notFound } from '@/lib/errors';
import { computeTotals, riderPayout } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { deliveryCode, orderReference } from '@/lib/reference';
import { asyncHandler, validate } from '@/middleware';
import { requireAuth } from '@/middleware/auth';
import { buildStepper, transitionOrder } from '@/services/orders';

export const ordersRouter = Router();

ordersRouter.use(requireAuth('customer'));

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
  note: z.string().max(200).optional(),
});

const createOrderSchema = z.object({
  vendorId: z.string().min(1),
  addressId: z.string().min(1),
  items: z.array(cartItemSchema).min(1, 'Your cart is empty.'),
  scheduledFor: z.coerce.date().optional(),
  discountKobo: z.number().int().min(0).default(0),
});

const errandSchema = z.object({
  addressId: z.string().min(1),
  task: z.string().min(3).max(300),
  details: z.string().max(1000).optional(),
  pickupName: z.string().min(2).max(160),
  pickupAddress: z.string().min(4).max(240),
  budgetKobo: z.number().int().min(0).optional(),
  photoUrls: z.array(z.string().url()).max(3).default([]),
});

const packageSchema = z.object({
  pickupName: z.string().min(2).max(120),
  pickupAddress: z.string().min(4).max(240),
  pickupPhone: z.string().min(10).max(20).optional(),
  dropoffName: z.string().min(2).max(120),
  dropoffAddress: z.string().min(4).max(240),
  dropoffPhone: z.string().min(10).max(20),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE']).default('SMALL'),
  contents: z.string().max(80).optional(),
  isFragile: z.boolean().default(false),
  notes: z.string().max(500).optional(),
  addressId: z.string().optional(),
  scheduledFor: z.coerce.date().optional(),
});

// Parcel pricing. Kept server-side so the app can never invent a cheaper fee.
const PARCEL_FEE_KOBO: Record<string, number> = {
  SMALL: 130_000,
  MEDIUM: 190_000,
  LARGE: 280_000,
  EXTRA_LARGE: 420_000,
};

/**
 * POST /orders — food or marketplace order from a cart.
 *
 * Prices come from the database, never from the client: the request sends
 * product IDs and quantities only.
 */
ordersRouter.post(
  '/',
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const customerId = req.auth!.id;
    const body = req.body as z.infer<typeof createOrderSchema>;

    const [vendor, address] = await Promise.all([
      prisma.vendor.findUnique({ where: { id: body.vendorId } }),
      prisma.address.findFirst({ where: { id: body.addressId, userId: customerId } }),
    ]);

    if (!vendor) throw notFound('Vendor');
    if (!address) throw notFound('Address');
    if (!vendor.isOpen && !body.scheduledFor) {
      throw conflict(`${vendor.name} is closed right now. Schedule it for later instead.`);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: body.items.map((i) => i.productId) }, vendorId: vendor.id },
    });

    if (products.length !== body.items.length) {
      throw badRequest('One or more items are no longer available from this vendor.');
    }

    const priceById = new Map(products.map((p) => [p.id, p]));
    const subtotalKobo = body.items.reduce((sum, item) => {
      const product = priceById.get(item.productId)!;
      return sum + product.priceKobo * item.quantity;
    }, 0);

    const totals = computeTotals({
      subtotalKobo,
      deliveryFeeKobo: vendor.deliveryFeeKobo,
      discountKobo: body.discountKobo,
      freeOverKobo: vendor.freeOverKobo,
    });

    const order = await prisma.order.create({
      data: {
        reference: orderReference(),
        type: products.some((p) => p.isMarketplace) ? 'MARKETPLACE' : 'FOOD',
        status: 'PENDING_PAYMENT',
        customerId,
        vendorId: vendor.id,
        addressId: address.id,
        scheduledFor: body.scheduledFor,
        deliveryCode: deliveryCode(),
        ...totals,
        items: {
          create: body.items.map((item) => {
            const product = priceById.get(item.productId)!;
            return {
              productId: product.id,
              name: product.name,
              note: item.note,
              unitPriceKobo: product.priceKobo,
              quantity: item.quantity,
            };
          }),
        },
      },
      include: { items: true, vendor: true },
    });

    res.status(201).json({ data: order });
  })
);

/** POST /orders/errand — the custom-task pillar. */
ordersRouter.post(
  '/errand',
  validate(errandSchema),
  asyncHandler(async (req, res) => {
    const customerId = req.auth!.id;
    const body = req.body as z.infer<typeof errandSchema>;

    const address = await prisma.address.findFirst({ where: { id: body.addressId, userId: customerId } });
    if (!address) throw notFound('Address');

    // The rider's shopping budget is held now and reconciled from the receipt.
    const totals = computeTotals({
      subtotalKobo: body.budgetKobo ?? 0,
      deliveryFeeKobo: env.DEFAULT_DELIVERY_FEE_KOBO,
    });

    const order = await prisma.order.create({
      data: {
        reference: orderReference(),
        type: 'ERRAND',
        status: 'PENDING_PAYMENT',
        customerId,
        addressId: address.id,
        deliveryCode: deliveryCode(),
        ...totals,
        errandDetail: {
          create: {
            task: body.task,
            details: body.details,
            pickupName: body.pickupName,
            pickupAddress: body.pickupAddress,
            budgetKobo: body.budgetKobo,
            photoUrls: body.photoUrls,
          },
        },
      },
      include: { errandDetail: true },
    });

    res.status(201).json({ data: order });
  })
);

/** POST /orders/package — point-A-to-point-B delivery. */
ordersRouter.post(
  '/package',
  validate(packageSchema),
  asyncHandler(async (req, res) => {
    const customerId = req.auth!.id;
    const body = req.body as z.infer<typeof packageSchema>;

    const deliveryFeeKobo = PARCEL_FEE_KOBO[body.size] ?? env.DEFAULT_DELIVERY_FEE_KOBO;

    // A parcel has no goods value — the delivery fee is the whole charge, and
    // there is no service fee to add on top of it.
    const order = await prisma.order.create({
      data: {
        reference: orderReference(),
        type: 'PACKAGE',
        status: 'PENDING_PAYMENT',
        customerId,
        addressId: body.addressId,
        scheduledFor: body.scheduledFor,
        deliveryCode: deliveryCode(),
        subtotalKobo: 0,
        deliveryFeeKobo,
        serviceFeeKobo: 0,
        discountKobo: 0,
        totalKobo: deliveryFeeKobo,
        riderPayoutKobo: riderPayout(deliveryFeeKobo),
        packageDetail: {
          create: {
            pickupName: body.pickupName,
            pickupAddress: body.pickupAddress,
            pickupPhone: body.pickupPhone,
            dropoffName: body.dropoffName,
            dropoffAddress: body.dropoffAddress,
            dropoffPhone: body.dropoffPhone,
            size: body.size,
            contents: body.contents,
            isFragile: body.isFragile,
            notes: body.notes,
          },
        },
      },
      include: { packageDetail: true },
    });

    res.status(201).json({ data: order });
  })
);

/** GET /orders?status=active|history */
ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const customerId = req.auth!.id;
    const filter = String(req.query.status ?? 'all');

    const ACTIVE = ['PENDING_PAYMENT', 'PLACED', 'VENDOR_ACCEPTED', 'RIDER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] as const;
    const DONE = ['DELIVERED', 'CANCELLED', 'REFUNDED'] as const;

    const orders = await prisma.order.findMany({
      where: {
        customerId,
        ...(filter === 'active'
          ? { status: { in: [...ACTIVE] } }
          : filter === 'history'
            ? { status: { in: [...DONE] } }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { name: true, slug: true, coverUrl: true } },
        items: { select: { id: true, name: true, quantity: true } },
        packageDetail: { select: { dropoffAddress: true, size: true } },
        errandDetail: { select: { task: true, pickupName: true } },
      },
      take: 50,
    });

    res.json({ data: orders });
  })
);

/** GET /orders/:id — full detail plus the tracking stepper. */
ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id!, customerId: req.auth!.id },
      include: {
        vendor: true,
        address: true,
        items: true,
        errandDetail: true,
        packageDetail: true,
        events: { orderBy: { createdAt: 'asc' } },
        rider: {
          select: { id: true, firstName: true, lastName: true, plateNumber: true, rating: true, phone: true },
        },
        payments: { select: { id: true, provider: true, status: true, amountKobo: true, paidAt: true } },
      },
    });

    if (!order) throw notFound('Order');

    res.json({
      data: {
        ...order,
        stepper: buildStepper(order.events, order.status, order.type),
      },
    });
  })
);

/** POST /orders/:id/cancel — allowed until a rider has picked up. */
ordersRouter.post(
  '/:id/cancel',
  validate(z.object({ reason: z.string().max(300).optional() })),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id!, customerId: req.auth!.id },
      select: { id: true, status: true },
    });

    if (!order) throw notFound('Order');
    if (['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(order.status)) {
      throw conflict('Your rider is already on the way. Contact support to cancel this one.');
    }

    const updated = await transitionOrder(
      order.id,
      'CANCELLED',
      { type: 'customer', id: req.auth!.id },
      { note: req.body.reason, extra: { cancelReason: req.body.reason } }
    );

    res.json({ data: updated });
  })
);
