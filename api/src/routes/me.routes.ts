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
