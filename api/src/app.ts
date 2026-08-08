import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, features } from '@/config/env';
import { forbidden } from '@/lib/errors';
import { apiLimiter, errorHandler, notFoundHandler } from '@/middleware';
import { adminRouter } from '@/routes/admin.routes';
import { authRouter } from '@/routes/auth.routes';
import { marketplaceRouter } from '@/routes/marketplace.routes';
import { meRouter } from '@/routes/me.routes';
import { ordersRouter } from '@/routes/orders.routes';
import { paymentsRouter, paystackWebhook } from '@/routes/payments.routes';
import { riderRouter } from '@/routes/rider.routes';
import { uploadsRouter } from '@/routes/uploads.routes';
import { vendorApplicationsRouter } from '@/routes/vendor-applications.routes';
import { vendorRouter } from '@/routes/vendor.routes';
import { vendorsRouter } from '@/routes/vendors.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // behind Render/Railway/nginx, for correct rate-limit IPs

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Native apps and curl send no Origin header — allow those through.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);

        /**
         * A plain Error here reaches the error handler as an unknown failure and
         * becomes a 500 INTERNAL_ERROR, which is actively misleading: the browser
         * shows a generic network failure and the server log implies the API
         * broke, when in fact the deploy is simply missing an origin. Raising a
         * typed 403 names the origin that was rejected, so the fix — add it to
         * CORS_ORIGINS and restart — is readable straight off the response.
         */
        cb(forbidden(`Origin ${origin} is not in CORS_ORIGINS.`));
      },
      credentials: true,
    })
  );

  if (!env.isProd) app.use(morgan('dev'));

  /**
   * The Paystack webhook is mounted BEFORE express.json() and takes a raw body:
   * the HMAC is computed over the exact bytes Paystack sent, so parsing and
   * re-serialising the JSON would break signature verification.
   */
  app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), paystackWebhook);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      env: env.NODE_ENV,
      integrations: {
        otpChannel: env.OTP_CHANNEL,
        whatsapp: features.whatsapp ? 'live' : 'stubbed (set WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN)',
        sms: features.sms ? 'live' : 'stubbed (set TERMII_API_KEY)',
        payments: features.paystack ? 'live' : 'stubbed (set PAYSTACK_SECRET_KEY)',
        uploads: features.cloudinary ? 'live' : 'stubbed (set CLOUDINARY_* keys)',
        otpDevMode: env.OTP_DEV_MODE,
      },
    });
  });

  const v1 = express.Router();
  v1.use(apiLimiter);

  v1.use('/auth', authRouter);
  v1.use('/me', meRouter);
  v1.use('/vendors', vendorsRouter);
  v1.use('/vendor-applications', vendorApplicationsRouter);
  v1.use('/orders', ordersRouter);
  v1.use('/marketplace', marketplaceRouter);
  v1.use('/rider', riderRouter);
  v1.use('/vendor', vendorRouter);
  v1.use('/payments', paymentsRouter);
  v1.use('/uploads', uploadsRouter);
  v1.use('/admin', adminRouter);

  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
