import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

/**
 * Credits a customer wallet for testing, with a matching statement line.
 *
 * The balance and the statement are two columns that have to agree — the wallet
 * screen renders both, and a balance that moved with nothing behind it looks
 * exactly like a bug in the ledger. Writing the WalletTransaction is not
 * bookkeeping neatness; it is what makes the screen truthful.
 *
 * Wallet balance is spendable value, not a display number. Money credited here
 * can pay for a real order, which accrues a real rider earning, which becomes a
 * real payout obligation against the Paystack balance. "Test money" only stays
 * test money if nothing downstream is live.
 *
 *   npx tsx scripts/credit-wallet.ts someone@example.com 10000
 */
const prisma = new PrismaClient();

const email = process.argv[2]?.trim().toLowerCase();
const naira = Number(process.argv[3]);

if (!email || !Number.isFinite(naira) || naira <= 0) {
  console.error('\n  Usage: npx tsx scripts/credit-wallet.ts <email> <naira>\n');
  process.exit(1);
}

async function main() {
  const amountKobo = Math.round(naira * 100);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user) throw new Error(`No customer account uses ${email}`);

    const balanceKobo = user.walletBalanceKobo + amountKobo;

    await tx.user.update({ where: { id: user.id }, data: { walletBalanceKobo: balanceKobo } });

    await tx.walletTransaction.create({
      data: {
        userId: user.id,
        // ADJUSTMENT, not TOPUP: no money entered the business, and labelling it
        // a top-up would put a payment in the statement that never happened.
        type: 'ADJUSTMENT',
        amountKobo,
        balanceKobo,
        description: 'Test credit',
        reference: `ADJ_${Date.now()}`,
      },
    });

    return { name: `${user.firstName} ${user.lastName}`, before: user.walletBalanceKobo, balanceKobo };
  });

  const ngn = (k: number) => `₦${(k / 100).toLocaleString('en-NG')}`;
  console.log(`\n  ${result.name} <${email}>`);
  console.log(`  ${ngn(result.before)} + ${ngn(amountKobo)} = ${ngn(result.balanceKobo)}\n`);
}

main()
  .catch((err) => {
    console.error('\n  ✗', err instanceof Error ? err.message : err, '\n');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
