import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';

import { conflict, notFound, unauthorized } from '@/lib/errors';
import { signToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { asyncHandler, validate } from '@/middleware';
import { requireAuth } from '@/middleware/auth';
import { transitionOrder } from '@/services/orders';

export const adminRouter = Router();

/** POST /admin/login — email + password (admins don't use OTP). */
adminRouter.post(
  '/login',
  validate(z.object({ email: z.string().email(), password: z.string().min(8) })),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    // Compare regardless, so a missing account and a wrong password take the
    // same time and can't be told apart.
    const ok = await bcrypt.compare(password, admin?.passwordHash ?? '$2a$10$invalidhashinvalidhashinvalidhashinvalidhash');

    if (!admin || !admin.isActive || !ok) throw unauthorized('Those credentials are not correct.');

    res.json({
      data: {
        token: signToken({ sub: admin.id, actor: 'admin' }),
        admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      },
    });
  })
);

adminRouter.use(requireAuth('admin'));

/** GET /admin/dashboard — the KPI tiles. */
adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [ordersToday, gmv, activeRiders, pendingRiders, openRequests, liveOrders] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      // GMV is the value of what was ORDERED today, not what has landed — a
      // dashboard that only counted deliveries read ₦0 all morning while the
      // board filled with live orders. Cancelled orders are excluded because
      // they never become revenue.
      prisma.order.aggregate({
        where: {
          createdAt: { gte: todayStart },
          status: { notIn: ['CANCELLED', 'REFUNDED', 'PENDING_PAYMENT'] },
        },
        _sum: { totalKobo: true },
      }),
      prisma.rider.count({ where: { isOnline: true, status: 'APPROVED' } }),
      prisma.rider.count({ where: { status: 'IN_REVIEW' } }),
      prisma.marketplaceRequest.count({ where: { status: 'OPEN', closesAt: { gt: new Date() } } }),
      prisma.order.count({
        where: { status: { in: ['PLACED', 'VENDOR_ACCEPTED', 'RIDER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
      }),
    ]);

    res.json({
      data: {
        ordersToday,
        gmvTodayKobo: gmv._sum.totalKobo ?? 0,
        activeRiders,
        pendingVerifications: pendingRiders,
        openRequests,
        liveOrders,
      },
    });
  })
);

/** GET /admin/riders?status=IN_REVIEW — the verification queue. */
adminRouter.get(
  '/riders',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;

    const riders = await prisma.rider.findMany({
      where: status ? { status: status as never } : {},
      include: { documents: true, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ data: riders });
  })
);

/** PATCH /admin/riders/:id/verify — approve or reject a rider. */
adminRouter.patch(
  '/riders/:id/verify',
  validate(
    z.object({
      status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']),
      note: z.string().max(300).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { status, note } = req.body as { status: 'APPROVED' | 'REJECTED' | 'SUSPENDED'; note?: string };
    const riderId = req.params.id!;

    const rider = await prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw notFound('Rider');

    const updated = await prisma.$transaction(async (tx) => {
      // A rejected or suspended rider must not stay online holding jobs.
      const r = await tx.rider.update({
        where: { id: riderId },
        data: { status, ...(status === 'APPROVED' ? {} : { isOnline: false }) },
      });

      await tx.riderDocument.updateMany({
        where: { riderId, status: 'IN_REVIEW' },
        data: {
          status: status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          reviewNote: note,
          reviewedAt: new Date(),
        },
      });

      return r;
    });

    res.json({ data: updated });
  })
);

/** GET /admin/orders — order management, filterable. */
adminRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const q = req.query.q as string | undefined;

    const orders = await prisma.order.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(type ? { type: type as never } : {}),
        ...(q ? { reference: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        rider: { select: { firstName: true, lastName: true, phone: true } },
        vendor: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ data: orders });
  })
);

/** GET /admin/orders/:id */
adminRouter.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id! },
      include: {
        customer: true,
        rider: true,
        vendor: true,
        address: true,
        items: true,
        events: { orderBy: { createdAt: 'asc' } },
        payments: true,
        errandDetail: true,
        packageDetail: true,
      },
    });

    if (!order) throw notFound('Order');
    res.json({ data: order });
  })
);

/** POST /admin/orders/:id/assign — manual rider assignment. */
adminRouter.post(
  '/orders/:id/assign',
  validate(z.object({ riderId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id!;
    const { riderId } = req.body as { riderId: string };

    const [order, rider] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, riderId: true } }),
      prisma.rider.findUnique({ where: { id: riderId }, select: { id: true, status: true } }),
    ]);

    if (!order) throw notFound('Order');
    if (!rider) throw notFound('Rider');
    if (rider.status !== 'APPROVED') throw conflict('That rider is not approved yet.');
    if (order.riderId && order.riderId !== riderId) {
      throw conflict('This order already has a rider. Unassign them first.');
    }

    await prisma.order.update({ where: { id: orderId }, data: { riderId } });
    const updated = await transitionOrder(orderId, 'RIDER_ASSIGNED', { type: 'admin', id: req.auth!.id });

    res.json({ data: updated });
  })
);

/** POST /admin/orders/:id/status — ops override for stuck orders. */
adminRouter.post(
  '/orders/:id/status',
  validate(
    z.object({
      status: z.enum([
        'PLACED', 'VENDOR_ACCEPTED', 'RIDER_ASSIGNED',
        'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'REFUNDED',
      ]),
      note: z.string().max(300).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { status, note } = req.body as { status: never; note?: string };
    const updated = await transitionOrder(req.params.id!, status, { type: 'admin', id: req.auth!.id }, { note });
    res.json({ data: updated });
  })
);

/**
 * POST /admin/orders/:id/refund — refunds to the Sendy Wallet.
 *
 * Wallet credit is instant, which is what customers actually want; bank
 * reversals through Paystack are a Phase-2 concern.
 */
adminRouter.post(
  '/orders/:id/refund',
  validate(z.object({ amountKobo: z.number().int().min(1).optional(), reason: z.string().max(300).optional() })),
  asyncHandler(async (req, res) => {
    const orderId = req.params.id!;
    const body = req.body as { amountKobo?: number; reason?: string };

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw notFound('Order');

      const amountKobo = body.amountKobo ?? order.totalKobo;
      const user = await tx.user.findUnique({ where: { id: order.customerId } });
      if (!user) throw notFound('Customer');

      const balanceKobo = user.walletBalanceKobo + amountKobo;

      await tx.user.update({ where: { id: user.id }, data: { walletBalanceKobo: balanceKobo } });
      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type: 'REFUND',
          amountKobo,
          balanceKobo,
          description: `Refund for ${order.reference}${body.reason ? ` — ${body.reason}` : ''}`,
          reference: order.reference,
        },
      });
      await tx.payment.updateMany({
        where: { orderId, status: 'SUCCESS' },
        data: { status: 'REFUNDED' },
      });

      await transitionOrder(orderId, 'REFUNDED', { type: 'admin', id: req.auth!.id }, { note: body.reason, tx });

      return { amountKobo, balanceKobo };
    });

    res.json({ data: result });
  })
);

/** GET /admin/requests — errand & marketplace request management. */
adminRouter.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;

    const requests = await prisma.marketplaceRequest.findMany({
      where: status ? { status: status as never } : {},
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        bids: { include: { vendor: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ data: requests });
  })
);

/**
 * GET /admin/vendors — every vendor, for the management table.
 *
 * Deliberately not the public `GET /vendors`: that one caps `limit` at 50 and
 * hides nothing-to-sell vendors behind catalogue sorting, so ops would silently
 * stop seeing vendors past the cap. Management needs the whole list, including
 * unverified and closed ones.
 */
adminRouter.get(
  '/vendors',
  asyncHandler(async (_req, res) => {
    const vendors = await prisma.vendor.findMany({
      orderBy: [{ isVerified: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true, orders: true } } },
    });
    res.json({ data: vendors });
  })
);

/** PATCH /admin/vendors/:id — approve a vendor and its bidding eligibility. */
adminRouter.patch(
  '/vendors/:id',
  validate(
    z.object({
      isVerified: z.boolean().optional(),
      canBid: z.boolean().optional(),
      isOpen: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.update({
      where: { id: req.params.id! },
      data: req.body,
    });
    res.json({ data: vendor });
  })
);
