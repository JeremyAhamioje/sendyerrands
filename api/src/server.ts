import { createApp } from '@/app';
import { env, features } from '@/config/env';
import { prisma } from '@/lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`\n  Sendy Errands API — ${env.NODE_ENV}`);
  console.log(`  ➜  http://localhost:${env.PORT}/api/v1`);
  console.log(`  ➜  health: http://localhost:${env.PORT}/health`);
  console.log(`  Email:    ${features.email ? 'Resend (live)' : 'not configured — resets will not send'}`);
  console.log(
    `  Payments: ${
      features.paystack
        ? features.paystackLive
          ? 'Paystack LIVE — REAL MONEY'
          : 'Paystack (test mode)'
        : 'stubbed — wallet only'
    }`
  );
  if (env.OTP_DEV_MODE)
    console.log(`  OTP dev mode ON — every password reset accepts code ${env.OTP_DEV_CODE}\n`);
});

// Finish in-flight requests before dropping the database connection.
async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
