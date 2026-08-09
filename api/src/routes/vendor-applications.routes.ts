import { Router } from 'express';
import { z } from 'zod';

import { conflict, notFound } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { asyncHandler, validate } from '@/middleware';
import { requireAuth } from '@/middleware/auth';

export const vendorApplicationsRouter = Router();

vendorApplicationsRouter.use(requireAuth('customer'));

const applicationSchema = z.object({
  businessName: z.string().min(2).max(120),
  category: z.string().min(2).max(60),
  area: z.string().min(2).max(80),
  // Coarse location, so an approved vendor is filterable from day one.
  state: z.string().min(2).max(40).default('Lagos'),
  phone: z.string().min(10).max(20),
  address: z.string().max(240).optional(),
  contactName: z.string().max(120).optional(),
});

/**
 * POST /vendor-applications — apply to sell on Sendy Errands.
 *
 * Only the fields a human needs to decide "should we call these people back".
 * Delivery fees, opening hours and the catalogue are set by ops on approval,
 * because an applicant cannot meaningfully choose them yet and asking would
 * cost conversions on a form whose whole purpose is low friction.
 */
vendorApplicationsRouter.post(
  '/',
  validate(applicationSchema),
  asyncHandler(async (req, res) => {
    const applicantId = req.auth!.id;
    const body = req.body as z.infer<typeof applicationSchema>;

    // One open application at a time, so ops don't review duplicates.
    const pending = await prisma.vendorApplication.findFirst({
      where: { applicantId, status: 'PENDING' },
      select: { id: true, businessName: true },
    });

    if (pending) {
      throw conflict(
        `You already have an application in for ${pending.businessName}. We'll be in touch once it's reviewed.`
      );
    }

    const application = await prisma.vendorApplication.create({
      data: { ...body, applicantId },
    });

    res.status(201).json({ data: application });
  })
);

/** GET /vendor-applications/mine — so the app can show the current status. */
vendorApplicationsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const applications = await prisma.vendorApplication.findMany({
      where: { applicantId: req.auth!.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        businessName: true,
        category: true,
        area: true,
        status: true,
        note: true,
        createdAt: true,
        reviewedAt: true,
      },
    });

    res.json({ data: applications });
  })
);

/** GET /vendor-applications/:id — the applicant's own application. */
vendorApplicationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const application = await prisma.vendorApplication.findFirst({
      where: { id: req.params.id!, applicantId: req.auth!.id },
    });

    if (!application) throw notFound('Application');

    res.json({ data: application });
  })
);
