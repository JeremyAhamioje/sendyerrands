import 'dotenv/config';
import { z } from 'zod';

// Fail fast and loudly at boot rather than at 2am on a missing key.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(24, 'JWT_SECRET must be at least 24 characters'),
  JWT_EXPIRES_IN: z.string().default('30d'),

  OTP_DEV_MODE: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  OTP_DEV_CODE: z.string().default('123456'),

  // Which channel carries the OTP. See services/otp-delivery.ts.
  OTP_CHANNEL: z.enum(['auto', 'whatsapp', 'sms']).default('auto'),

  // WhatsApp Cloud API (Meta) — the default OTP channel.
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_OTP_TEMPLATE: z.string().default('sendy_otp'),
  WHATSAPP_TEMPLATE_LANG: z.string().default('en'),
  WHATSAPP_TEMPLATE_HAS_BUTTON: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_BASE_URL: z.string().default('https://graph.facebook.com'),

  // Termii SMS — fallback channel.
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().default('Sendy'),
  TERMII_BASE_URL: z.string().default('https://api.ng.termii.com'),

  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_BASE_URL: z.string().default('https://api.paystack.co'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('sendy'),

  DEFAULT_DELIVERY_FEE_KOBO: z.coerce.number().default(130_000),
  SERVICE_FEE_KOBO: z.coerce.number().default(30_000),
  PLATFORM_COMMISSION_BPS: z.coerce.number().default(1_500),
  BID_WINDOW_MINUTES: z.coerce.number().default(30),
  JOB_LOCK_SECONDS: z.coerce.number().default(120),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`\n✗ Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
};

/** True when the integration has real credentials configured. */
export const features = {
  whatsapp: Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN),
  sms: Boolean(env.TERMII_API_KEY),
  paystack: Boolean(env.PAYSTACK_SECRET_KEY),
  cloudinary: Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  ),
};

// Loud warning rather than a hard failure: the API is meant to run end-to-end
// on stubs so the app can be demoed before the merchant accounts exist.
if (env.isProd) {
  if (!features.whatsapp && !features.sms)
    console.warn('⚠  No OTP channel configured — set WHATSAPP_* (preferred) or TERMII_API_KEY.');
  if (!features.paystack) console.warn('⚠  PAYSTACK_SECRET_KEY missing — card payments are disabled.');
  if (env.OTP_DEV_MODE) console.warn('⚠  OTP_DEV_MODE is ON in production. Any device can log in as any phone number.');
}
