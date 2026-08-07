import { Router } from 'express';
import { z } from 'zod';

import { badRequest, conflict, forbidden, notFound } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { asyncHandler, validate } from '@/middleware';
import { requireApprovedRider, requireAuth } from '@/middleware/auth';
import { isOwnCloudinaryUrl } from '@/services/cloudinary';
import { transitionOrder } from '@/services/orders';

export const riderRouter = Router();

riderRouter.use(requireAuth('rider'));

/** GET /rider/me */
riderRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const rider = await prisma.rider.findUnique({
      where: { id: req.auth!.id },
      include: { documents: true },
    });
    if (!rider) throw notFound('Rider');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const today = await prisma.riderEarning.aggregate({
      where: { riderId: rider.id, createdAt: { gte: todayStart } },
      _sum: { netKobo: true },
      _count: true,
    });

    res.json({
      data: {
        ...rider,
        today: {
          earningsKobo: today._sum.netKobo ?? 0,
          trips: today._count,
        },
      },
    });
  })
);

/** PATCH /rider/availability — the online/offline toggle. */
riderRouter.patch(
  '/availability',
  validate(z.object({ isOnline: z.boolean() })),
  asyncHandler(async (req, res) => {
    const { isOnline } = req.body as { isOnline: boolean };

    const rider = await prisma.rider.findUnique({
      where: { id: req.auth!.id },
      select: { status: true },
    });
    if (!rider) throw notFound('Rider');
    if (isOnline && rider.status !== 'APPROVED') {
      throw forbidden('You can go online once your documents are approved.');
    }

    const updated = await prisma.rider.update({
      where: { id: req.auth!.id },
      data: { isOnline },
      select: { id: true, isOnline: true, zone: true },
    });

    res.json({ data: updated });
  })
);

/**
 * GET /rider/jobs — unassigned orders that are ready for a rider.
 * Browsable while documents are in review; accepting is what needs approval.
 */
riderRouter.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    const sort = String(req.query.sort ?? 'nearest');

    const jobs = await prisma.order.findMany({
      where: {
        riderId: null,
        status: { in: ['PLACED', 'VENDOR_ACCEPTED'] },
      },
      include: {
        vendor: { select: { name: true, area: true } },
        address: { select: { line1: true, city: true, landmark: true } },
        errandDetail: { select: { task: true, pickupName: true, pickupAddress: true } },
        packageDetail: { select: { pickupName: true, pickupAddress: true, dropoffName: true, dropoffAddress: true, size: true } },
      },
      orderBy: sort === 'payout' ? { riderPayoutKobo: 'desc' } : { createdAt: 'asc' },
      take: 50,
    });

    res.json({ data: jobs });
  })
);

/** GET /rider/jobs/:id */
riderRouter.get(
  '/jobs/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id!,
        OR: [{ riderId: null }, { riderId: req.auth!.id }],
      },
      include: {
        vendor: true,
        address: true,
        items: true,
        errandDetail: true,
        packageDetail: true,
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    if (!order) throw notFound('Job');
    res.json({ data: order });
  })
);

/**
 * POST /rider/jobs/:id/accept
 *
 * The claim is a conditional update on riderId = null. If two riders tap at the
 * same moment, exactly one row is affected and the other gets a clean 409 —
 * no double-assignment, no row locking needed.
 */
riderRouter.post(
  '/jobs/:id/accept',
  requireApprovedRider,
  asyncHandler(async (req, res) => {
    const riderId = req.auth!.id;
    const orderId = req.params.id!;

    const claimed = await prisma.order.updateMany({
      where: { id: orderId, riderId: null, status: { in: ['PLACED', 'VENDOR_ACCEPTED'] } },
      data: { riderId },
    });

    if (claimed.count === 0) {
      throw conflict('Another rider just took that job. Pull down to refresh.');
    }

    const order = await transitionOrder(orderId, 'RIDER_ASSIGNED', { type: 'rider', id: riderId });
    res.json({ data: order });
  })
);

/** GET /rider/jobs/active — whatever this rider is currently carrying. */
riderRouter.get(
  '/active',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: {
        riderId: req.auth!.id,
        status: { in: ['RIDER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
      },
      include: {
        vendor: true,
        address: true,
        items: true,
        errandDetail: true,
        packageDetail: true,
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({ data: order });
  })
);

/**
 * POST /rider/jobs/:id/status — the slide-to-confirm control.
 * DELIVERED additionally requires the 4-digit code the customer reads out.
 */
riderRouter.post(
  '/jobs/:id/status',
  requireApprovedRider,
  validate(
    z.object({
      status: z.enum(['PICKED_UP', 'IN_TRANSIT', 'DELIVERED']),
      deliveryCode: z.string().length(4).optional(),
      proofUrl: z.string().url().optional(),
      spentKobo: z.number().int().min(0).optional(),
      receiptUrl: z.string().url().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const riderId = req.auth!.id;
    const orderId = req.params.id!;
    const body = req.body as {
      status: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED';
      deliveryCode?: string;
      proofUrl?: string;
      spentKobo?: number;
      receiptUrl?: string;
    };

    const order = await prisma.order.findFirst({
      where: { id: orderId, riderId },
      select: { id: true, status: true, deliveryCode: true, type: true },
    });

    if (!order) throw notFound('Job');

    if (body.status === 'DELIVERED') {
      if (!body.deliveryCode) throw conflict('Ask the customer for their 4-digit code.');
      if (body.deliveryCode !== order.deliveryCode) {
        throw conflict('That code does not match. Check with the customer.');
      }
    }

    if (body.proofUrl && !isOwnCloudinaryUrl(body.proofUrl)) {
      throw badRequest('Take the delivery photo in the app.');
    }

    // Errand receipts reconcile the held budget against what was actually spent.
    if (order.type === 'ERRAND' && body.spentKobo !== undefined) {
      await prisma.errandDetail.update({
        where: { orderId },
        data: { spentKobo: body.spentKobo, receiptUrl: body.receiptUrl },
      });
    }

    const updated = await transitionOrder(
      orderId,
      body.status,
      { type: 'rider', id: riderId },
      { extra: body.proofUrl ? { proofUrl: body.proofUrl } : undefined }
    );

    res.json({ data: updated });
  })
);

/** GET /rider/earnings?range=today|week|month */
riderRouter.get(
  '/earnings',
  asyncHandler(async (req, res) => {
    const riderId = req.auth!.id;
    const range = String(req.query.range ?? 'week');

    const since = new Date();
    if (range === 'today') since.setHours(0, 0, 0, 0);
    else if (range === 'month') since.setDate(since.getDate() - 30);
    else since.setDate(since.getDate() - 7);

    const [earnings, unpaid, rider] = await Promise.all([
      prisma.riderEarning.findMany({
        where: { riderId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { reference: true, type: true, deliveredAt: true } } },
      }),
      prisma.riderEarning.aggregate({
        where: { riderId, isPaidOut: false },
        _sum: { netKobo: true },
      }),
      prisma.rider.findUnique({
        where: { id: riderId },
        select: { rating: true, completedJobs: true },
      }),
    ]);

    // Group into a day-by-day series for the bar chart.
    const byDay = new Map<string, number>();
    for (const e of earnings) {
      const key = e.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + e.netKobo);
    }

    res.json({
      data: {
        range,
        availableKobo: unpaid._sum.netKobo ?? 0,
        totalKobo: earnings.reduce((sum, e) => sum + e.netKobo, 0),
        trips: earnings.length,
        rating: rider?.rating ?? 5,
        completedJobs: rider?.completedJobs ?? 0,
        series: [...byDay.entries()]
          .map(([day, valueKobo]) => ({ day, valueKobo }))
          .sort((a, b) => a.day.localeCompare(b.day)),
        earnings,
      },
    });
  })
);

/** POST /rider/documents — verification upload. */
riderRouter.post(
  '/documents',
  validate(
    z.object({
      type: z.enum(['NIN', 'LICENCE', 'PHOTO', 'VEHICLE_PAPERS', 'GUARANTOR_FORM']),
      fileUrl: z.string().url(),
    })
  ),
  asyncHandler(async (req, res) => {
    const riderId = req.auth!.id;
    const body = req.body as { type: 'NIN' | 'LICENCE' | 'PHOTO' | 'VEHICLE_PAPERS' | 'GUARANTOR_FORM'; fileUrl: string };

    // Must be an asset in our own Cloudinary account, not an arbitrary URL.
    if (!isOwnCloudinaryUrl(body.fileUrl)) {
      throw badRequest('Upload the document through the app before submitting it.');
    }

    const doc = await prisma.riderDocument.upsert({
      where: { riderId_type: { riderId, type: body.type } },
      create: { riderId, type: body.type, fileUrl: body.fileUrl, status: 'IN_REVIEW' },
      update: { fileUrl: body.fileUrl, status: 'IN_REVIEW', reviewNote: null, reviewedAt: null },
    });

    // Once every required document is in, move the rider into the admin queue.
    const REQUIRED = ['NIN', 'LICENCE', 'PHOTO', 'VEHICLE_PAPERS', 'GUARANTOR_FORM'];
    const submitted = await prisma.riderDocument.count({ where: { riderId } });
    if (submitted >= REQUIRED.length) {
      await prisma.rider.updateMany({
        where: { id: riderId, status: 'PENDING' },
        data: { status: 'IN_REVIEW' },
      });
    }

    res.status(201).json({ data: doc });
  })
);
