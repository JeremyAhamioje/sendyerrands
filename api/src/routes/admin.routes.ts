import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';

import { badRequest, conflict, forbidden, notFound, unauthorized } from '@/lib/errors';
import { signToken } from '@/lib/jwt';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { asyncHandler, validate } from '@/middleware';
import { requireAuth } from '@/middleware/auth';
import { transitionOrder } from '@/services/orders';
import {
  PAYOUT_HOLD_HOURS,
  PAYOUT_MIN_KOBO,
  payableFor,
  reconcilePayout,
  sendPayout,
  voidEarningForOrder,
} from '@/services/payouts';

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
 * POST /admin/orders/:id/refund — refunds to the Sendy Errands Wallet.
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

      /**
       * The rider was owed for this delivery. Refunding reverses the sale, so
       * the earning has to go with it — otherwise the rider is still owed for
       * something that no longer exists, and once transfers go live we pay it.
       *
       * If the money already left, say so rather than quietly rewriting
       * history: recovering it is a conversation, not a database update.
       */
      const earning = await voidEarningForOrder(
        orderId,
        `Order ${order.reference} refunded${body.reason ? ` — ${body.reason}` : ''}`,
        tx
      );

      await transitionOrder(orderId, 'REFUNDED', { type: 'admin', id: req.auth!.id }, { note: body.reason, tx });

      return { amountKobo, balanceKobo, riderEarning: earning };
    });

    res.json({ data: result });
  })
);

/**
 * GET /admin/payouts — the ledger, plus who is currently owed.
 *
 * Read-only by design. Sending the money is phase 3, and creating a payout is
 * what marks earnings as paid — exposing that button before anything can settle
 * it would let ops mark riders paid with nothing behind it.
 */
adminRouter.get(
  '/payouts',
  asyncHandler(async (_req, res) => {
    const [payouts, riders] = await Promise.all([
      prisma.payout.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          rider: { select: { firstName: true, lastName: true, phone: true } },
          _count: { select: { earnings: true } },
        },
      }),
      prisma.rider.findMany({
        where: { earnings: { some: { isPaidOut: false, voidedAt: null } } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          bankName: true,
          bankAccountNo: true,
          bankAccountName: true,
        },
      }),
    ]);

    // One query per owed rider. Fine at this size — the list is riders with
    // unpaid work, not the whole fleet — and worth revisiting past a few dozen.
    const due = await Promise.all(riders.map(async (r) => ({ ...r, ...(await payableFor(r.id)) })));

    res.json({
      data: {
        holdHours: PAYOUT_HOLD_HOURS,
        minimumKobo: PAYOUT_MIN_KOBO,
        due: due.sort((a, b) => b.payableKobo - a.payableKobo),
        payouts,
      },
    });
  })
);

/**
 * POST /admin/riders/:id/payout — pays a rider what they are owed.
 *
 * Restricted to OPERATIONS and SUPERADMIN. Support staff can see the ledger and
 * cannot move money on it.
 */
adminRouter.post(
  '/riders/:id/payout',
  validate(z.object({ ignoreMinimum: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.findUnique({
      where: { id: req.auth!.id },
      select: { role: true },
    });
    if (admin?.role !== 'OPERATIONS' && admin?.role !== 'SUPERADMIN') {
      throw forbidden('Only operations staff can release payouts.');
    }

    const { ignoreMinimum } = req.body as { ignoreMinimum?: boolean };
    res.json({ data: await sendPayout(req.params.id!, { ignoreMinimum }) });
  })
);

/**
 * POST /admin/payouts/:id/reconcile — asks Paystack what became of a payout.
 *
 * The way out of PENDING when a transfer request died in flight, and the manual
 * equivalent of a webhook that never arrived.
 */
adminRouter.post(
  '/payouts/:id/reconcile',
  asyncHandler(async (req, res) => {
    res.json({ data: await reconcilePayout(req.params.id!) });
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
        invitedVendors: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ data: requests });
  })
);

/**
 * POST /admin/requests/:id/invite — choose which vendors get to quote.
 *
 * Replaces the whole set rather than appending, so the dashboard's multi-select
 * is the source of truth and unticking a vendor actually removes it.
 *
 * An empty list is meaningful, not a no-op: it returns the request to being
 * open to every eligible vendor. See GET /marketplace/open-requests.
 */
adminRouter.post(
  '/requests/:id/invite',
  validate(z.object({ vendorIds: z.array(z.string().min(1)).max(50) })),
  asyncHandler(async (req, res) => {
    const { vendorIds } = req.body as { vendorIds: string[] };

    const request = await prisma.marketplaceRequest.findUnique({
      where: { id: req.params.id! },
      select: { id: true, status: true },
    });
    if (!request) throw notFound('Request');

    if (request.status !== 'OPEN') {
      throw conflict('Bidding is closed on this request, so vendors cannot be invited.');
    }

    // Only vendors that can actually bid — inviting one that cannot would show
    // ops a vendor on the request who will never see it.
    const eligible = await prisma.vendor.findMany({
      where: { id: { in: vendorIds }, canBid: true, isVerified: true },
      select: { id: true },
    });

    if (eligible.length !== vendorIds.length) {
      throw badRequest('One or more of those vendors is not verified or cannot bid.');
    }

    const updated = await prisma.marketplaceRequest.update({
      where: { id: request.id },
      data: { invitedVendors: { set: eligible.map((v) => ({ id: v.id })) } },
      include: { invitedVendors: { select: { id: true, name: true } } },
    });

    res.json({ data: updated });
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

/** GET /admin/vendor-applications?status=PENDING — the onboarding queue. */
adminRouter.get(
  '/vendor-applications',
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    const valid = ['PENDING', 'APPROVED', 'REJECTED'] as const;
    const filter = valid.find((s) => s === status);

    const applications = await prisma.vendorApplication.findMany({
      where: filter ? { status: filter } : {},
      // Pending first, then oldest first: an application waiting three days
      // should be the one ops sees, not the one that arrived this morning.
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      include: {
        applicant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        vendor: { select: { id: true, name: true, slug: true } },
      },
      take: 200,
    });

    res.json({ data: applications });
  })
);

/**
 * Turns a business name into a URL slug, with a numeric suffix if taken.
 *
 * Vendor.slug is unique and is what the app routes on, so two applicants both
 * called "Mama's Kitchen" must not collide — the second approval would throw a
 * constraint error and lose the review.
 */
async function uniqueVendorSlug(businessName: string): Promise<string> {
  const base =
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'vendor';

  for (let n = 0; ; n++) {
    const slug = n === 0 ? base : `${base}-${n}`;
    const taken = await prisma.vendor.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
}

/**
 * POST /admin/vendor-applications/:id/decide — approve or reject.
 *
 * Approving creates the Vendor unverified and closed. The application carries
 * nothing about delivery fees, opening hours or a catalogue, so a vendor that
 * went live on approval would be an empty storefront customers could tap into.
 * Ops fills those in, then flips verified — see the isVerified filter on the
 * public vendor list.
 */
adminRouter.post(
  '/vendor-applications/:id/decide',
  validate(
    z.object({
      decision: z.enum(['APPROVE', 'REJECT']),
      note: z.string().max(500).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body as { decision: 'APPROVE' | 'REJECT'; note?: string };

    const application = await prisma.vendorApplication.findUnique({
      where: { id: req.params.id! },
    });
    if (!application) throw notFound('Application');

    if (application.status !== 'PENDING') {
      throw conflict(`This application was already ${application.status.toLowerCase()}.`);
    }

    if (decision === 'REJECT') {
      const updated = await prisma.vendorApplication.update({
        where: { id: application.id },
        data: { status: 'REJECTED', note, reviewedAt: new Date() },
      });
      res.json({ data: updated });
      return;
    }

    const slug = await uniqueVendorSlug(application.businessName);

    /**
     * The application's phone becomes the vendor's login, so approval is the
     * moment the applicant can actually sign in. It is unique across vendors —
     * if that number already runs one, ops has to sort out which business it
     * belongs to rather than have the second approval fail on a constraint.
     */
    const phoneTaken = await prisma.vendor.findUnique({
      where: { phone: application.phone },
      select: { id: true, name: true },
    });

    if (phoneTaken) {
      throw conflict(
        `${application.phone} already signs in for ${phoneTaken.name}. Ask the applicant for a different number before approving.`
      );
    }

    // One transaction: a Vendor with no application pointing at it would be an
    // orphan ops could not trace back to who asked for it.
    const [, updated] = await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: {
          name: application.businessName,
          slug,
          area: application.area,
          state: application.state,
          // Doubles as the login for /phone?role=vendor.
          phone: application.phone,
          tags: [application.category],
          isVerified: false,
          isOpen: false,
        },
      });

      const app = await tx.vendorApplication.update({
        where: { id: application.id },
        data: { status: 'APPROVED', note, reviewedAt: new Date(), vendorId: vendor.id },
        include: { vendor: { select: { id: true, name: true, slug: true } } },
      });

      return [vendor, app] as const;
    });

    res.json({ data: updated });
  })
);

/** GET /admin/vendors/:id/products — the vendor's catalogue, for managing listings. */
adminRouter.get(
  '/vendors/:id/products',
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id! },
      select: { id: true, name: true },
    });
    if (!vendor) throw notFound('Vendor');

    const products = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      orderBy: [{ section: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { orderItems: true } } },
    });

    res.json({ data: { vendor, products } });
  })
);

/**
 * DELETE /admin/products/:id — remove a listing.
 *
 * A hard delete is safe here, which is not obvious. OrderItem denormalises the
 * name and unit price at the time of purchase and its productId is nullable
 * with ON DELETE SET NULL, so past orders keep reading correctly — they simply
 * stop linking to a catalogue entry that no longer exists. Soft-deleting
 * instead would mean every catalogue query in the app growing an
 * `isDeleted: false` filter, and the first one that forgot would resurrect the
 * listing for customers.
 */
adminRouter.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id! },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!product) throw notFound('Product');

    await prisma.product.delete({ where: { id: product.id } });

    res.json({
      data: {
        id: product.id,
        name: product.name,
        // Lets the dashboard say what the delete touched rather than guess.
        orderItemsUnlinked: product._count.orderItems,
      },
    });
  })
);

/**
 * DELETE /admin/vendors/:id — remove a vendor that never traded.
 *
 * Refused once the vendor has orders. Order.vendorId is ON DELETE SET NULL and
 * Order stores no vendor name of its own, so deleting a traded vendor would
 * quietly erase who fulfilled every one of its past orders — unrecoverable, and
 * invisible until someone went looking for the history. Taking the vendor
 * offline achieves what deleting is usually meant to achieve, without that.
 */
adminRouter.delete(
  '/vendors/:id',
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id! },
      include: { _count: { select: { products: true, orders: true } } },
    });
    if (!vendor) throw notFound('Vendor');

    if (vendor._count.orders > 0) {
      throw conflict(
        `${vendor.name} has ${vendor._count.orders} order(s) and cannot be deleted — ` +
          'that would erase which vendor fulfilled them. Switch it to unverified and ' +
          'closed instead to take it off the app.'
      );
    }

    // Products cascade (Product.vendor is onDelete: Cascade).
    await prisma.vendor.delete({ where: { id: vendor.id } });

    res.json({
      data: { id: vendor.id, name: vendor.name, productsDeleted: vendor._count.products },
    });
  })
);

/**
 * POST /admin/password-reset — set a new password for a locked-out account.
 *
 * Stands in for the self-service reset flow, which needs an email provider the
 * deployment does not have yet. Support takes the address over the phone, types
 * it here, and reads the generated password back to the customer.
 *
 * The password is generated rather than chosen by whoever is on the call: an
 * operator picking one produces "sendy123" every time, and it means a human
 * decided the credential for an account they do not own. It is shown once, in
 * the response, and never stored in readable form — asking again generates a
 * different one.
 *
 * This is deliberately not a way to sign in AS a customer. It changes the
 * password, which the account holder will notice, rather than minting a token
 * that would let an operator act as them silently.
 */
const adminResetSchema = z.object({
  email: z
    .string()
    .email('Enter the account email.')
    .transform((v) => v.trim().toLowerCase()),
  role: z.enum(['customer', 'rider', 'vendor']),
});

/**
 * Ambiguity-free alphabet — no O/0, l/1/I. The whole point is that this gets
 * read aloud down a phone line and typed by someone who cannot see it.
 */
const SPEAKABLE = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generatePassword(length = 14): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += SPEAKABLE[bytes[i]! % SPEAKABLE.length];
  return out;
}

adminRouter.post(
  '/password-reset',
  validate(adminResetSchema),
  asyncHandler(async (req, res) => {
    const { email, role } = req.body as z.infer<typeof adminResetSchema>;

    const account =
      role === 'vendor'
        ? await prisma.vendor.findUnique({ where: { email }, select: { id: true, name: true } })
        : role === 'rider'
          ? await prisma.rider.findUnique({
              where: { email },
              select: { id: true, firstName: true, lastName: true },
            })
          : await prisma.user.findUnique({
              where: { email },
              select: { id: true, firstName: true, lastName: true },
            });

    // Named plainly. This endpoint is behind an admin token, so there is no
    // account-enumeration concern to protect against — and an operator on a
    // call needs to know the address is simply wrong.
    if (!account) throw notFound(`No ${role} account uses ${email}`);

    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    if (role === 'vendor') {
      await prisma.vendor.update({ where: { email }, data: { passwordHash } });
    } else if (role === 'rider') {
      await prisma.rider.update({ where: { email }, data: { passwordHash } });
    } else {
      await prisma.user.update({ where: { email }, data: { passwordHash } });
    }

    // Any live reset codes for this address are now stale.
    await prisma.otpCode.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const name =
      'name' in account
        ? account.name
        : `${account.firstName ?? ''} ${account.lastName ?? ''}`.trim();

    console.warn(`[admin] password reset for ${role} ${email} by admin ${req.auth!.id}`);

    res.json({ data: { email, role, name, password } });
  })
);
