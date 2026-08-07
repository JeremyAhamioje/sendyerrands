import { Router } from 'express';
import { z } from 'zod';

import { env } from '@/config/env';
import { badRequest, conflict, forbidden, notFound } from '@/lib/errors';
import { computeTotals } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { deliveryCode, orderReference } from '@/lib/reference';
import { asyncHandler, validate } from '@/middleware';
import { requireAuth } from '@/middleware/auth';

export const marketplaceRouter = Router();

const createRequestSchema = z.object({
  title: z.string().min(3).max(200),
  details: z.string().max(1000).optional(),
  quantity: z.number().int().min(1).max(999).default(1),
  budgetKobo: z.number().int().min(0).optional(),
  dropoffArea: z.string().min(2).max(80),
  addressId: z.string().optional(),
  photoUrls: z.array(z.string().url()).max(3).default([]),
  bidWindowMinutes: z.number().int().min(5).max(1440).optional(),
});

const bidSchema = z.object({
  vendorId: z.string().min(1),
  priceKobo: z.number().int().min(1),
  etaMinutes: z.number().int().min(5).max(1440),
  note: z.string().max(300).optional(),
});

/** GET /marketplace/products — the Marketplace browse grid. */
marketplaceRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    const products = await prisma.product.findMany({
      where: {
        isMarketplace: true,
        inStock: true,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: { vendor: { select: { name: true, slug: true, isVerified: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ data: products });
  })
);

/**
 * GET /marketplace/products/:id — one product, for the item detail screen.
 *
 * Not scoped to `isMarketplace`: the same screen opens both a vendor's menu
 * item and a marketplace listing, and a menu item is not flagged for the
 * marketplace grid. The vendor is included because the screen shows who is
 * selling and links back to their page.
 */
marketplaceRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id! },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            slug: true,
            isVerified: true,
            isOpen: true,
            etaMinMinutes: true,
            etaMaxMinutes: true,
            deliveryFeeKobo: true,
            // The item screen seeds the cart's fee preview from these, so it
            // has to know about free delivery too.
            freeOverKobo: true,
          },
        },
      },
    });

    if (!product) throw notFound('Product');
    res.json({ data: product });
  })
);

// ── customer: post a request, read bids, pick a winner ───────────────

marketplaceRouter.post(
  '/requests',
  requireAuth('customer'),
  validate(createRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createRequestSchema>;
    const minutes = body.bidWindowMinutes ?? env.BID_WINDOW_MINUTES;

    const request = await prisma.marketplaceRequest.create({
      data: {
        customerId: req.auth!.id,
        title: body.title,
        details: body.details,
        quantity: body.quantity,
        budgetKobo: body.budgetKobo,
        dropoffArea: body.dropoffArea,
        addressId: body.addressId,
        photoUrls: body.photoUrls,
        closesAt: new Date(Date.now() + minutes * 60_000),
      },
    });

    res.status(201).json({ data: request });
  })
);

marketplaceRouter.get(
  '/requests',
  requireAuth('customer'),
  asyncHandler(async (req, res) => {
    const requests = await prisma.marketplaceRequest.findMany({
      where: { customerId: req.auth!.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { bids: true } } },
      take: 50,
    });

    res.json({ data: requests });
  })
);

/**
 * GET /marketplace/requests/:id — the "Bids received" screen.
 * `sort` mirrors the app's chips; `isBestPrice` always marks the genuinely
 * cheapest bid regardless of the active sort, so the badge can't mislead.
 */
marketplaceRouter.get(
  '/requests/:id',
  requireAuth('customer'),
  asyncHandler(async (req, res) => {
    const sort = String(req.query.sort ?? 'price');

    const request = await prisma.marketplaceRequest.findFirst({
      where: { id: req.params.id!, customerId: req.auth!.id },
      include: {
        bids: {
          where: { status: { in: ['SUBMITTED', 'SELECTED'] } },
          include: {
            vendor: {
              select: { id: true, name: true, rating: true, isVerified: true, ratingCount: true },
            },
          },
        },
      },
    });

    if (!request) throw notFound('Request');

    const cheapest = request.bids.length ? Math.min(...request.bids.map((b) => b.priceKobo)) : null;

    const bids = [...request.bids].sort((a, b) => {
      if (sort === 'eta') return a.etaMinutes - b.etaMinutes;
      if (sort === 'rating') return b.vendor.rating - a.vendor.rating;
      return a.priceKobo - b.priceKobo;
    });

    res.json({
      data: {
        ...request,
        bids: bids.map((b) => ({ ...b, isBestPrice: b.priceKobo === cheapest })),
        isOpen: request.status === 'OPEN' && request.closesAt > new Date(),
      },
    });
  })
);

/**
 * POST /marketplace/requests/:id/select — pick a winning bid.
 * Creates the order that a rider will then be dispatched against (design.md
 * §11 step 4). Payment is authorised separately via /payments.
 */
marketplaceRouter.post(
  '/requests/:id/select',
  requireAuth('customer'),
  validate(z.object({ bidId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const customerId = req.auth!.id;
    const requestId = req.params.id!;
    const { bidId } = req.body as { bidId: string };

    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.marketplaceRequest.findFirst({
        where: { id: requestId, customerId },
        include: { bids: true },
      });

      if (!request) throw notFound('Request');
      if (request.status !== 'OPEN') throw conflict('You have already picked a winner for this request.');
      if (request.closesAt < new Date()) throw conflict('Bidding has closed on this request.');

      const bid = request.bids.find((b) => b.id === bidId);
      if (!bid) throw notFound('Bid');
      if (bid.status !== 'SUBMITTED') throw conflict('That bid is no longer available.');

      /**
       * The order inherits the request's address, and `addressId` is optional
       * on a request — so without this a winning bid produced an order with no
       * drop-off. It reached the rider board as a job with a blank destination,
       * which no rider can complete. Better to stop it here than to pay someone
       * to ride nowhere.
       */
      if (!request.addressId) {
        throw badRequest('Add a delivery address to this request before picking a winner.');
      }

      const totals = computeTotals({
        subtotalKobo: bid.priceKobo,
        deliveryFeeKobo: env.DEFAULT_DELIVERY_FEE_KOBO,
      });

      const order = await tx.order.create({
        data: {
          reference: orderReference(),
          type: 'MARKETPLACE',
          status: 'PENDING_PAYMENT',
          customerId,
          vendorId: bid.vendorId,
          addressId: request.addressId,
          deliveryCode: deliveryCode(),
          ...totals,
          items: {
            create: {
              name: request.title,
              unitPriceKobo: bid.priceKobo,
              quantity: request.quantity,
            },
          },
        },
      });

      await tx.bid.update({ where: { id: bid.id }, data: { status: 'SELECTED' } });
      await tx.bid.updateMany({
        where: { requestId, id: { not: bid.id }, status: 'SUBMITTED' },
        data: { status: 'REJECTED' },
      });
      await tx.marketplaceRequest.update({
        where: { id: requestId },
        data: { status: 'BID_SELECTED', orderId: order.id },
      });

      return order;
    });

    res.status(201).json({ data: result });
  })
);

// ── vendor: browse open requests and bid ────────────────────────────
//
// Vendors authenticate as admins in Phase 1 (there is no vendor app yet — the
// portal is Phase 2). Ops staff submit bids on a vendor's behalf.

marketplaceRouter.get(
  '/open-requests',
  requireAuth('admin'),
  asyncHandler(async (_req, res) => {
    const requests = await prisma.marketplaceRequest.findMany({
      where: { status: 'OPEN', closesAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { bids: true } } },
      take: 100,
    });

    res.json({ data: requests });
  })
);

marketplaceRouter.post(
  '/requests/:id/bids',
  requireAuth('admin'),
  validate(bidSchema),
  asyncHandler(async (req, res) => {
    const requestId = req.params.id!;
    const body = req.body as z.infer<typeof bidSchema>;

    const [request, vendor] = await Promise.all([
      prisma.marketplaceRequest.findUnique({ where: { id: requestId } }),
      prisma.vendor.findUnique({ where: { id: body.vendorId } }),
    ]);

    if (!request) throw notFound('Request');
    if (!vendor) throw notFound('Vendor');
    if (!vendor.canBid) throw forbidden('This vendor is not approved to bid yet.');
    if (request.status !== 'OPEN') throw conflict('This request is no longer accepting bids.');
    if (request.closesAt < new Date()) throw conflict('Bidding has closed on this request.');
    if (body.priceKobo <= 0) throw badRequest('Enter a bid price.');

    // One live bid per vendor — re-bidding updates the existing row.
    const bid = await prisma.bid.upsert({
      where: { requestId_vendorId: { requestId, vendorId: vendor.id } },
      create: {
        requestId,
        vendorId: vendor.id,
        priceKobo: body.priceKobo,
        etaMinutes: body.etaMinutes,
        note: body.note,
      },
      update: {
        priceKobo: body.priceKobo,
        etaMinutes: body.etaMinutes,
        note: body.note,
        status: 'SUBMITTED',
      },
    });

    res.status(201).json({ data: bid });
  })
);
