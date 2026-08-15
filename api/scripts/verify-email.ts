import 'dotenv/config';

import { passwordResetEmail, sendEmail } from '../src/services/email';

/**
 * Sends one real password-reset email to an address you name.
 *
 * Exists because every way this fails looks the same from inside the app: the
 * forgot-password endpoint answers 200 whether or not the address is
 * registered, whether or not the key is valid, and whether or not the domain is
 * verified — deliberately, so it cannot be used to discover who has an account.
 * That means a broken email setup is invisible from the client, and the only
 * honest way to check is to send one and go and look.
 *
 *   npx tsx scripts/verify-email.ts you@example.com
 */
const to = process.argv[2];

if (!to || !to.includes('@')) {
  console.error('\n  Usage: npx tsx scripts/verify-email.ts you@example.com\n');
  process.exit(1);
}

async function main() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  console.log('');
  if (!key) {
    console.error('  ✗ RESEND_API_KEY is not set. Nothing will send.\n');
    process.exit(1);
  }
  if (!key.startsWith('re_')) {
    console.log('  ⚠  RESEND_API_KEY does not start with "re_" — check you copied the whole key.');
  }
  console.log(`  From: ${from}`);
  console.log(`  To:   ${to}`);

  /**
   * The same message the app sends, not a "hello world". A test that exercises
   * a different code path than production proves nothing about production —
   * this is the exact builder the reset endpoint uses.
   */
  const mail = passwordResetEmail('123456', 15);
  const result = await sendEmail({ to, ...mail });

  if (!result.ok) {
    console.error(`\n  ✗ Send failed: ${result.reason}\n`);
    console.error('  Common causes:');
    console.error('    · the domain in EMAIL_FROM is not verified in Resend');
    console.error('    · the API key is restricted to a different domain');
    console.error('    · EMAIL_FROM is not a real address on the verified domain\n');
    process.exit(1);
  }

  console.log(`\n  ✓ Accepted by Resend (id ${result.id})`);
  console.log('\n  Now go and look. Accepted is not delivered — an unverified domain is');
  console.log('  accepted by the API and then binned by the inbox provider. Check spam');
  console.log('  too: if it landed there, add a DMARC record before real customers see it.\n');
}

main().catch((err) => {
  console.error('  ✗ Could not reach Resend:', err instanceof Error ? err.message : err);
  process.exit(1);
});
