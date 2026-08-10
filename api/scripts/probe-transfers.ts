/**
 * Checks what Paystack will actually let this account do with transfers.
 *
 * Touches no rows in our database. It reads the balance, registers a recipient
 * (harmless and deduplicated on Paystack's side), and attempts the smallest
 * possible transfer so the account's real capability is known before a payout
 * button exists to press.
 *
 *   npx tsx scripts/probe-transfers.ts
 */
import { prisma } from '../src/lib/prisma';
import {
  createTransferRecipient,
  fetchAvailableBalanceKobo,
  initiateTransfer,
  verifyTransfer,
} from '../src/services/paystack';

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`;

async function main() {
  console.log('1. balance');
  try {
    const balance = await fetchAvailableBalanceKobo();
    console.log(`   available: ${naira(balance)}`);
  } catch (err) {
    console.log(`   FAILED: ${(err as Error).message}`);
  }

  console.log('\n2. transfer recipient');
  let recipient: string | null = null;
  try {
    recipient = await createTransferRecipient({
      name: 'OLUWASEUN VICTOR OWOKOLADE',
      accountNumber: '0000000000',
      bankCode: '044',
    });
    console.log(`   created: ${recipient}`);
  } catch (err) {
    console.log(`   FAILED: ${(err as Error).message}`);
  }

  if (!recipient) return;

  // ₦50 is Paystack's floor for a single transfer — below it the request is
  // refused before anything else is even looked at.
  const amountKobo = Number(process.argv[2] ?? 5_000);

  console.log(`\n3. transfer of ${naira(amountKobo)}`);
  const reference = `PROBE_${Date.now()}`;
  try {
    const transfer = await initiateTransfer({
      amountKobo,
      recipientCode: recipient,
      reference,
      reason: 'Phase 3 capability probe',
    });
    console.log(`   accepted: status=${transfer.status} code=${transfer.transfer_code}`);

    const verified = await verifyTransfer(reference);
    console.log(`   verified: status=${verified.status}`);
    console.log('\n   → Transfers work on this account.');
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.log(`   REFUSED (${e.code}): ${e.message}`);
    console.log(
      '\n   → Refused, but note what refused it. A message about amounts or balance means\n' +
        '     transfers are enabled and the request was understood. Only a permissions or\n' +
        '     activation message means the account cannot send money yet.'
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
