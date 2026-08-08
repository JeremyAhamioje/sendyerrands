import { Router } from 'express';
import { z } from 'zod';

import { notFound } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { asyncHandler, validate } from '@/middleware';
import { requireAuth } from '@/middleware/auth';

export const meRouter = Router();

meRouter.use(requireAuth('customer'));

const profileSchema = z.object({
  firstName: z.string().min(2).max(40).optional(),
  lastName: z.string().min(2).max(40).optional(),
  email: z.string().email().optional(),
});

const addressSchema = z.object({
  label: z.string().min(1).max(30),
  line1: z.string().min(4).max(160),
  line2: z.string().max(160).optional(),
  city: z.string().max(60).default('Lagos'),
  landmark: z.string().max(160).optional(),
  contact: z.string().min(2).max(80),
  phone: z.string().min(10).max(20),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().default(false),
});

/** GET /me */
meRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.id },
      select: {
        id: true, phone: true, firstName: true, lastName: true, email: true,
        walletBalanceKobo: true, referralCode: true, createdAt: true,
      },
    });
    if (!user) throw notFound('Account');
    res.json({ data: user });
  })
);

/** PATCH /me */
meRouter.patch(
  '/',
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.auth!.id },
      data: req.body,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    res.json({ data: user });
  })
);

/** GET /me/addresses */
meRouter.get(
  '/addresses',
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({
      where: { userId: req.auth!.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ data: addresses });
  })
);

/** POST /me/addresses */
meRouter.post(
  '/addresses',
  validate(addressSchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.id;
    const body = req.body as z.infer<typeof addressSchema>;

    const address = await prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      // First address is always the default, whatever the client sent.
      const isDefault = count === 0 ? true : body.isDefault;

      if (isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({ data: { ...body, isDefault, userId } });
    });

    res.status(201).json({ data: address });
  })
);

/** PATCH /me/addresses/:id */
meRouter.patch(
  '/addresses/:id',
  validate(addressSchema.partial()),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.id;
    const id = req.params.id!;

    const existing = await prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw notFound('Address');

    const body = req.body as Partial<z.infer<typeof addressSchema>>;

    const address = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({ where: { id }, data: body });
    });

    res.json({ data: address });
  })
);

/** DELETE /me/addresses/:id */
meRouter.delete(
  '/addresses/:id',
  asyncHandler(async (req, res) => {
    const userId = req.auth!.id;
    const id = req.params.id!;

    const existing = await prisma.address.findFirst({ where: { id, userId } });
    if (!existing) throw notFound('Address');

    await prisma.address.delete({ where: { id } });

    // Never leave the account without a default.
    if (existing.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    res.status(204).send();
  })
);

/** GET /me/wallet — balance plus a paginated statement. */
meRouter.get(
  '/wallet',
  asyncHandler(async (req, res) => {
    const userId = req.auth!.id;
    const take = Math.min(Number(req.query.limit ?? 30), 100);

    const [user, transactions] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { walletBalanceKobo: true } }),
      prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);

    if (!user) throw notFound('Account');
    res.json({ data: { balanceKobo: user.walletBalanceKobo, transactions } });
  })
);

/**
 * GET /me/favourites — vendors this customer saved.
 *
 * Returns whole vendor rows rather than ids: the Favourites screen renders the
 * same VendorCard as Home, and a list of ids would mean a second round trip
 * per card on a connection where that is exactly what to avoid.
 */
meRouter.get(
  '/favourites',
  asyncHandler(async (req, res) => {
    const favourites = await prisma.favourite.findMany({
      where: { userId: req.auth!.id },
      orderBy: { createdAt: 'desc' },
      include: { vendor: true },
    });

    res.json({ data: favourites.map((f) => f.vendor) });
  })
);

/**
 * PUT /me/favourites/:vendorId — save a vendor. Idempotent.
 *
 * A double tap on the heart, or a retry after a flaky request, must not be an
 * error: the unique constraint on (userId, vendorId) makes the second write a
 * no-op rather than a 409 the UI would have to explain.
 */
meRouter.put(
  '/favourites/:vendorId',
  asyncHandler(async (req, res) => {
    const vendorId = req.params.vendorId!;

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) throw notFound('Vendor');

    await prisma.favourite.upsert({
      where: { userId_vendorId: { userId: req.auth!.id, vendorId } },
      create: { userId: req.auth!.id, vendorId },
      update: {},
    });

    res.json({ data: { vendorId, saved: true } });
  })
);

/** DELETE /me/favourites/:vendorId — unsave. Also idempotent. */
meRouter.delete(
  '/favourites/:vendorId',
  asyncHandler(async (req, res) => {
    const vendorId = req.params.vendorId!;

    // deleteMany, not delete: removing something already gone is success here,
    // not a 404 the heart would have to render as a failure.
    await prisma.favourite.deleteMany({ where: { userId: req.auth!.id, vendorId } });

    res.json({ data: { vendorId, saved: false } });
  })
);
