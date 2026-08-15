import 'dotenv/config';

/**
 * Read-only check of whatever PAYSTACK_SECRET_KEY is currently configured.
 *
 * Run before and after switching to live keys. It answers the three questions
 * that matter and moves no money:
 *
 *   - is the key valid at all
 *   - is it live or test (the prefix says, and /transaction's `domain` confirms
 *     it against Paystack's own view rather than ours)
 *   - what is actually available to pay riders out of
 *
 *   npx tsx scripts/verify-paystack.ts
 */
const key = process.env.PAYSTACK_SECRET_KEY;

if (!key) {
  console.error('✗ PAYSTACK_SECRET_KEY is not set.');
  process.exit(1);
}

const claimedMode = key.startsWith('sk_live_') ? 'LIVE' : key.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN';

async function get(path: string) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

async function main() {
  console.log(`\n  Key prefix says: ${claimedMode}\n`);

  const balance = await get('/balance');
  if (balance.status === 401) {
    console.error('  ✗ Paystack rejected the key (401). It is wrong, revoked, or rotated.');
    process.exit(1);
  }
  if (balance.status !== 200) {
    console.error(`  ✗ /balance returned HTTP ${balance.status}:`, balance.body);
    process.exit(1);
  }

  const balances = (balance.body?.data ?? []) as { currency: string; balance: number }[];
  console.log('  Available balance');
  for (const b of balances) {
    console.log(`    ${b.currency}  ${(b.balance / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`);
  }

  // `domain` is Paystack's own label for which side of the account a
  // transaction lives on. It is the authoritative answer; the key prefix is
  // only what we think.
  const txn = await get('/transaction?perPage=1');
  const recent = (txn.body?.data as { domain?: string; reference?: string }[] | undefined)?.[0];
  console.log(`\n  Paystack says most recent transaction domain: ${recent?.domain ?? 'none recorded yet'}`);

  if (recent?.domain && recent.domain !== claimedMode.toLowerCase()) {
    console.log('  ⚠  That does not match the key prefix. Check which key is actually loaded.');
  }

  const ngn = balances.find((b) => b.currency === 'NGN')?.balance ?? 0;
  if (claimedMode === 'LIVE' && ngn === 0) {
    console.log('\n  ⚠  Live balance is zero. Payouts will fail until the account is funded —');
    console.log('     Paystack transfers draw from the balance, not from card revenue directly.');
  }
  console.log('');
}

main().catch((err) => {
  console.error('  ✗ Could not reach Paystack:', err instanceof Error ? err.message : err);
  process.exit(1);
});
