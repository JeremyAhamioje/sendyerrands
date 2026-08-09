import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';

import { env } from '@/config/env';
import { badRequest, tooMany, unauthorized } from '@/lib/errors';
import { signToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { normalisePhone, otpCode, referralCode } from '@/lib/reference';
import { asyncHandler, otpLimiter, validate } from '@/middleware';
import { requireAuth } from '@/middleware/auth';
import { deliverOtp } from '@/services/otp-delivery';

export const authRouter = Router();

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const phoneSchema = z.object({
  phone: z.string().min(10, 'Enter a valid phone number.'),
  role: z.enum(['customer', 'rider', 'vendor']).default('customer'),
});

const verifySchema = z.object({
  phone: z.string().min(10),
  code: z.string().length(6, 'The code is 6 digits.'),
  role: z.enum(['customer', 'rider', 'vendor']).default('customer'),
  // Only used when the account does not exist yet.
  firstName: z.string().min(2).max(40).optional(),
  lastName: z.string().min(2).max(40).optional(),
  email: z.string().email().optional(),
  referredByCode: z.string().optional(),
  /**
   * Riders only — what they ride and its plate.
   *
   * Collected at sign-up rather than chased later: dispatch matches on vehicle
   * (a three-bag grocery run cannot go on a bicycle), so a rider without one is
   * approved but unassignable, which looks like the job board being empty.
   */
  vehicleType: z.enum(['MOTORBIKE', 'BICYCLE', 'TRICYCLE', 'CAR', 'VAN', 'FOOT']).optional(),
  plateNumber: z.string().max(20).optional(),
});

/**
 * POST /auth/otp/request
 * Sends a 6-digit code. Always responds 200 for a valid number, whether or not
 * an account exists — otherwise this endpoint becomes a "is X a Sendy Errands user?"
 * oracle for anyone with a phone book.
 */
authRouter.post(
  '/otp/request',
  otpLimiter,
  validate(phoneSchema),
  asyncHandler(async (req, res) => {
    const { phone: raw, role } = req.body as z.infer<typeof phoneSchema>;
    const phone = normalisePhone(raw);
    if (!phone) throw badRequest('That does not look like a Nigerian phone number.');

    const purpose =
      role === 'rider' ? 'RIDER_LOGIN' : role === 'vendor' ? 'VENDOR_LOGIN' : 'CUSTOMER_LOGIN';
    const code = env.OTP_DEV_MODE ? env.OTP_DEV_CODE : otpCode();

    // Retire any outstanding codes so only the newest one works.
    await prisma.otpCode.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await prisma.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    });

    // WhatsApp first, SMS as fallback — see services/otp-delivery.ts.
    const delivery = env.OTP_DEV_MODE ? { channel: 'none' as const } : await deliverOtp(phone, code);

    res.json({
      data: {
        phone,
        expiresInSeconds: OTP_TTL_MINUTES * 60,
        // Lets the app say "sent to your WhatsApp" rather than guessing.
        channel: delivery.channel,
        // Present only in dev mode so the app can be demoed without a messaging account.
        ...(env.OTP_DEV_MODE ? { devCode: code } : {}),
      },
    });
  })
);

/**
 * POST /auth/otp/verify
 * Verifies the code and returns a JWT. Creates the account on first successful
 * verification (firstName/lastName required for a new customer).
 */
authRouter.post(
  '/otp/verify',
  otpLimiter,
  validate(verifySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof verifySchema>;
    const phone = normalisePhone(body.phone);
    if (!phone) throw badRequest('That does not look like a Nigerian phone number.');

    const purpose =
      body.role === 'rider' ? 'RIDER_LOGIN' : body.role === 'vendor' ? 'VENDOR_LOGIN' : 'CUSTOMER_LOGIN';

    const record = await prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw unauthorized('Request a new code.');
    if (record.expiresAt < new Date()) throw unauthorized('That code has expired. Request a new one.');
    if (record.attempts >= MAX_ATTEMPTS) throw tooMany('Too many wrong attempts. Request a new code.');

    const ok = await bcrypt.compare(body.code, record.codeHash);
    if (!ok) {
      await prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw unauthorized('That code is not correct.');
    }

    /**
     * Do NOT consume the code yet.
     *
     * A first-time number verifies twice: once from the OTP screen (which
     * returns needsProfile), then again from profile setup with a name
     * attached. Consuming on the first call made signup impossible — the
     * second verify always failed with "request a new code".
     *
     * The code is marked consumed further down, only once a token is issued.
     */
    const consumeCode = () =>
      prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

    /**
     * Vendors cannot sign themselves up.
     *
     * Customers and riders create their own account on first verify. A vendor
     * is different: it exists only because ops approved an application, which
     * is where the business name, category and area come from. If verifying an
     * unknown number created one, anyone could become a vendor on the Sendy Errands
     * marketplace by typing their own phone number in.
     */
    if (body.role === 'vendor') {
      const vendor = await prisma.vendor.findUnique({ where: { phone } });

      if (!vendor) {
        throw unauthorized(
          'No vendor account uses this number. Apply from Profile → Become a vendor, and we’ll set you up once approved.'
        );
      }

      await consumeCode();

      return res.json({
        data: {
          token: signToken({ sub: vendor.id, actor: 'vendor' }),
          isNewAccount: false,
          vendor: {
            id: vendor.id,
            name: vendor.name,
            slug: vendor.slug,
            phone: vendor.phone,
            isVerified: vendor.isVerified,
            isOpen: vendor.isOpen,
          },
        },
      });
    }

    const isSignup =
      !body.firstName || !body.lastName
        ? await (async () => {
            const existing =
              body.role === 'rider'
                ? await prisma.rider.findUnique({ where: { phone }, select: { id: true } })
                : await prisma.user.findUnique({ where: { phone }, select: { id: true } });
            return !existing;
          })()
        : false;

    if (isSignup) {
      // Account doesn't exist and we have no name — send them to profile setup
      // with the code still live.
      return res.status(200).json({ data: { needsProfile: true, phone } });
    }

    if (body.role === 'rider') {
      let rider = await prisma.rider.findUnique({ where: { phone } });
      let isNew = false;

      if (!rider) {
        rider = await prisma.rider.create({
          data: {
            phone,
            firstName: body.firstName!,
            lastName: body.lastName!,
            email: body.email,
            vehicleType: body.vehicleType,
            // Bicycles and riders on foot have no plate — store null, not ''.
            plateNumber: body.plateNumber?.trim().toUpperCase() || null,
          },
        });
        isNew = true;
      }

      await consumeCode();

      return res.json({
        data: {
          token: signToken({ sub: rider.id, actor: 'rider' }),
          isNewAccount: isNew,
          rider: {
            id: rider.id,
            phone: rider.phone,
            firstName: rider.firstName,
            lastName: rider.lastName,
            status: rider.status,
            isOnline: rider.isOnline,
          },
        },
      });
    }

    let user = await prisma.user.findUnique({ where: { phone } });
    let isNew = false;

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          firstName: body.firstName!,
          lastName: body.lastName!,
          email: body.email,
          referralCode: referralCode(body.firstName!),
          referredByCode: body.referredByCode,
        },
      });
      isNew = true;
    }

    await consumeCode();

    res.json({
      data: {
        token: signToken({ sub: user.id, actor: 'customer' }),
        isNewAccount: isNew,
        user: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          walletBalanceKobo: user.walletBalanceKobo,
          referralCode: user.referralCode,
        },
      },
    });
  })
);

/** GET /auth/session — cheap token check on app launch. */
authRouter.get(
  '/session',
  requireAuth('customer', 'rider', 'vendor'),
  asyncHandler(async (req, res) => {
    const { id, actor } = req.auth!;

    // Omitting vendor here would 403 on launch, and the app treats an auth
    // error from this call as an expired token — so every vendor would be
    // silently signed out the moment they reopened the app.
    if (actor === 'vendor') {
      const vendor = await prisma.vendor.findUnique({
        where: { id },
        select: { id: true, name: true, slug: true, phone: true, isVerified: true, isOpen: true },
      });
      if (!vendor) throw unauthorized();
      return res.json({ data: { actor, vendor } });
    }

    if (actor === 'rider') {
      const rider = await prisma.rider.findUnique({
        where: { id },
        select: { id: true, phone: true, firstName: true, lastName: true, status: true, isOnline: true, rating: true },
      });
      if (!rider) throw unauthorized();
      return res.json({ data: { actor, rider } });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, phone: true, firstName: true, lastName: true,
        email: true, walletBalanceKobo: true, referralCode: true,
      },
    });
    if (!user) throw unauthorized();
    res.json({ data: { actor, user } });
  })
);
