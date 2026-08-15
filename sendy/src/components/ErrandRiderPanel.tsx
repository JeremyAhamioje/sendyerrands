import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Card, Chip } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api/client';
import type { Bank } from '@/lib/api/endpoints';
import { useAssetSecured, useAtDoorstep, useBanks, useQuoteErrand } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import { koboToNaira } from '@/lib/api/mappers';
import { colors } from '@/lib/theme';

/**
 * The rider's half of the errand loop.
 *
 * Renders exactly one control, chosen from the server's status rather than
 * local state — a rider who closes the app mid-errand must come back to the
 * step they were actually on, not the one this component last remembered.
 *
 * The four states map to the four things only a rider can know: what the item
 * costs, where to pay for it, that they have it, and that they are at the door.
 */
export function ErrandRiderPanel({
  orderId,
  status,
  errand,
}: {
  orderId: string;
  status: string;
  errand: {
    task?: string;
    budgetKobo?: number | null;
    actualItemKobo?: number | null;
    merchantAccountName?: string | null;
    merchantAccountNo?: string | null;
    merchantBankName?: string | null;
  } | null;
}) {
  const { data: banks = [] } = useBanks();
  const quote = useQuoteErrand(orderId);
  const secured = useAssetSecured(orderId);
  const doorstep = useAtDoorstep(orderId);

  const [price, setPrice] = useState('');
  const [bank, setBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const priceNaira = Number(price.replace(/[^\d]/g, ''));
  const canQuote = priceNaira > 0 && Boolean(bank) && /^\d{10}$/.test(accountNumber);

  const shown = query.trim()
    ? banks.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()))
    : banks;

  const submitQuote = () => {
    setError(null);
    quote.mutate(
      { actualItemKobo: priceNaira * 100, bankCode: bank!.code, accountNumber },
      {
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : 'Could not send that price.'),
      }
    );
  };

  // ── price it ──────────────────────────────────────────────
  if (status === 'RIDER_ASSIGNED' || status === 'PRICE_PROPOSED') {
    const alreadySent = status === 'PRICE_PROPOSED';

    return (
      <Card className="p-4">
        <Text className="text-ink text-[17px] font-semibold">
          {alreadySent ? 'Waiting for the customer' : 'What does it actually cost?'}
        </Text>

        {alreadySent ? (
          <>
            <Text className="text-body text-[13px] mt-1.5 mb-3 leading-[19px]">
              They&apos;re transferring {naira(koboToNaira(errand?.actualItemKobo ?? 0))} to{' '}
              {errand?.merchantAccountName ?? 'the seller'}. You&apos;ll be told when it&apos;s sent
              — don&apos;t buy before then.
            </Text>
            {/* Prices move while someone is deciding, and the alternative to
                re-pricing is cancelling the job and starting over. */}
            <Text className="text-muted text-[13px] mb-3">Price changed? Send a new one.</Text>
          </>
        ) : (
          <Text className="text-body text-[13px] mt-1.5 mb-4 leading-[19px]">
            {errand?.budgetKobo
              ? `They guessed ${naira(koboToNaira(errand.budgetKobo))}. `
              : ''}
            Enter the real price and the seller&apos;s account — they pay the seller directly.
          </Text>
        )}

        <Input
          label="Item price"
          value={price}
          onChangeText={setPrice}
          placeholder="0"
          prefix="₦"
          keyboardType="number-pad"
        />

        <Text className="text-body text-[15px] mb-2">Seller&apos;s bank</Text>
        <View className="bg-surface rounded-md h-[44px] px-3.5 flex-row items-center mb-2.5">
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search banks"
            placeholderTextColor={colors.muted}
            className="flex-1 ml-2.5 text-ink text-[15px]"
            style={{ outlineStyle: 'none' } as never}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8 }}
          className="mb-4"
        >
          {shown.slice(0, 40).map((b) => (
            <View key={b.code} className="mr-2">
              <Chip label={b.name} selected={b.code === bank?.code} onPress={() => setBank(b)} />
            </View>
          ))}
        </ScrollView>

        <Input
          label="Seller's account number"
          value={accountNumber}
          onChangeText={(v) => setAccountNumber(v.replace(/\D/g, '').slice(0, 10))}
          placeholder="10 digits"
          keyboardType="number-pad"
          helper="We check the name on this account and show it to the customer."
        />

        {error ? <Text className="text-error text-[13px] mb-3">{error}</Text> : null}

        {/*
          Worth the rider seeing plainly: the name on this account goes to the
          customer, and it is the thing that makes a wrong number visible.
        */}
        <View className="flex-row items-start bg-surface rounded-md p-3 mb-4">
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.body} />
          <Text className="text-body text-[12px] ml-2 flex-1 leading-[17px]">
            The customer sees whose account this is before they send anything. Double-check the
            number with the seller.
          </Text>
        </View>

        <Button
          title={quote.isPending ? 'Sending…' : alreadySent ? 'Send new price' : 'Send price'}
          disabled={!canQuote || quote.isPending}
          loading={quote.isPending}
          onPress={submitQuote}
        />
      </Card>
    );
  }

  // ── buy it ────────────────────────────────────────────────
  if (status === 'MERCHANT_PAID') {
    return (
      <Card className="p-4">
        <View className="flex-row items-center">
          <Ionicons name="checkmark-circle" size={19} color={colors.success} />
          <Text className="text-ink text-[17px] font-semibold ml-2">The customer has paid</Text>
        </View>
        <Text className="text-body text-[13px] mt-2 mb-4 leading-[19px]">
          {naira(koboToNaira(errand?.actualItemKobo ?? 0))} was sent to{' '}
          {errand?.merchantAccountName ?? 'the seller'}. Collect the item, then confirm below.
        </Text>

        {secured.isError ? (
          <Text className="text-error text-[13px] mb-3">
            {secured.error instanceof ApiError
              ? secured.error.message
              : 'Could not confirm that.'}
          </Text>
        ) : null}

        <Button
          title={secured.isPending ? 'Confirming…' : 'I have the item'}
          loading={secured.isPending}
          onPress={() => secured.mutate()}
        />
      </Card>
    );
  }

  // ── deliver it ────────────────────────────────────────────
  if (status === 'PICKED_UP' || status === 'IN_TRANSIT') {
    return (
      <Card className="p-4">
        <Text className="text-ink text-[17px] font-semibold">On your way</Text>
        <Text className="text-body text-[13px] mt-2 mb-4 leading-[19px]">
          Let them know when you arrive so they can come out.
        </Text>

        {doorstep.isError ? (
          <Text className="text-error text-[13px] mb-3">
            {doorstep.error instanceof ApiError
              ? doorstep.error.message
              : 'Could not send that.'}
          </Text>
        ) : null}

        <Button
          title={doorstep.isPending ? 'Sending…' : 'I’m at the door'}
          loading={doorstep.isPending}
          onPress={() => doorstep.mutate()}
        />
      </Card>
    );
  }

  // AT_DOORSTEP falls through to the delivery-code entry the screen already
  // owns — handing over is the same act on every pillar.
  return null;
}
