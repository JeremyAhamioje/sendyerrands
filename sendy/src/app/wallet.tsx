import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Card, Divider, EmptyState, Skeleton } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { QueryError } from '@/components/ui/QueryError';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { ApiError } from '@/lib/api/client';
import { useSettleReturnedTopup, useTopUpWallet, useWallet } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import { colors } from '@/lib/theme';

/**
 * Sendy Errands Wallet (design.md §10, under Profile).
 *
 * Every figure here comes from `GET /me/wallet`. The statement used to be a
 * hardcoded array that looked convincing and moved for nobody — it survived the
 * wiring-up because the balance above it was real, so the screen never looked
 * broken.
 */

/** Amounts are small on purpose — see TOPUP_MIN_KOBO in payments.routes.ts. */
const PRESETS_KOBO = [1_000, 2_000, 5_000, 10_000];

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  TOPUP: 'add-circle-outline',
  ORDER_DEBIT: 'bag-handle-outline',
  REFUND: 'return-down-back-outline',
  REFERRAL_BONUS: 'gift-outline',
  PAYOUT: 'arrow-up-circle-outline',
  ADJUSTMENT: 'construct-outline',
};

export default function Wallet() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useWallet();
  const [funding, setFunding] = useState(false);

  // On web the payment takes the whole tab, so a top-up finishes with this
  // screen freshly mounted and no memory of having started one.
  const returned = useSettleReturnedTopup();

  const balance = data?.balance ?? 0;
  const transactions = data?.transactions ?? [];

  return (
    <Screen className="bg-surface">
      <View className="bg-white">
        <ScreenHeader title="Sendy Errands Wallet" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.pink[600]} />
        }
      >
        <LinearGradient
          colors={[colors.pink[600], colors.pink[900]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 16, padding: 20 }}
        >
          <Text className="text-white/80 text-[13px]">Available balance</Text>
          {isLoading ? (
            <View className="h-[41px] justify-center">
              <View className="bg-white/25 rounded-md h-7 w-40" />
            </View>
          ) : (
            <Text className="text-white text-[34px] font-bold mt-1">{naira(balance)}</Text>
          )}
          <View className="flex-row items-center mt-2">
            <View className="bg-white/20 rounded-full px-3 py-1.5 flex-row items-center">
              <Ionicons name="gift-outline" size={13} color={colors.white} />
              <Text className="text-white text-[11px] font-semibold ml-1.5">Instant refunds</Text>
            </View>
          </View>
        </LinearGradient>

        <View className="flex-row mt-4">
          <View className="flex-1 mr-3">
            <Button title="Fund wallet" icon="add" onPress={() => setFunding(true)} />
          </View>
          <View className="flex-1">
            {/* Disabled rather than absent: withdrawal is a planned feature and
                hiding it invites the same question every time. Disabled and
                explained answers it once. */}
            <Button title="Withdraw" variant="secondary" icon="arrow-up" disabled />
          </View>
        </View>
        <Text className="text-muted text-[12px] mt-2 text-center">
          Withdrawals to a bank account aren&apos;t live yet. Refunds land here instantly and can be
          spent on any order.
        </Text>

        {/* The outcome of a payment made in another tab. Without this the
            customer comes back to a screen that says nothing about what just
            happened to their money. */}
        {returned ? (
          <View
            className={`rounded-lg p-4 mt-4 ${returned.status === 'SUCCESS' ? 'bg-success/10' : 'bg-surface'}`}
          >
            <View className="flex-row items-center">
              <Ionicons
                name={returned.status === 'SUCCESS' ? 'checkmark-circle' : 'information-circle-outline'}
                size={18}
                color={returned.status === 'SUCCESS' ? colors.success : colors.muted}
              />
              <Text className="text-ink text-[14px] font-semibold ml-2">
                {returned.status === 'SUCCESS'
                  ? `${naira(returned.creditedKobo / 100)} added to your wallet`
                  : returned.status === 'ABANDONED'
                    ? 'That payment was not completed'
                    : "That payment didn't go through"}
              </Text>
            </View>
            {returned.status !== 'SUCCESS' ? (
              <Text className="text-muted text-[13px] mt-1">Nothing was charged.</Text>
            ) : null}
          </View>
        ) : null}

        <Text className="text-muted text-[13px] font-semibold mt-6 mb-2.5">TRANSACTIONS</Text>

        {isError ? (
          <Card className="p-4">
            <QueryError error={error} onRetry={() => refetch()} noun="your transactions" />
          </Card>
        ) : isLoading ? (
          <Card className="p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="w-full h-12 mb-3" />
            ))}
          </Card>
        ) : transactions.length === 0 ? (
          <Card className="py-2">
            <EmptyState
              icon="receipt-outline"
              title="Nothing here yet"
              body="Fund your wallet or place an order and every movement in and out will show up here."
            />
          </Card>
        ) : (
          <Card>
            {transactions.map((tx, i) => {
              const credit = tx.amount > 0;
              return (
                <View key={tx.id}>
                  {i > 0 ? <Divider className="mx-4" /> : null}
                  <View className="flex-row items-center px-4 py-3.5">
                    <View
                      className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
                        credit ? 'bg-success/10' : 'bg-surface'
                      }`}
                    >
                      <Ionicons
                        name={ICONS[tx.type] ?? 'ellipse-outline'}
                        size={17}
                        color={credit ? colors.success : colors.body}
                      />
                    </View>
                    <View className="flex-1 pr-2">
                      <Text className="text-ink text-[15px] font-medium" numberOfLines={1}>
                        {tx.description}
                      </Text>
                      <Text className="text-muted text-[13px] mt-0.5">{when(tx.createdAt)}</Text>
                    </View>
                    <Text
                      className={`text-[15px] font-bold ${credit ? 'text-success' : 'text-ink'}`}
                    >
                      {credit ? '+' : '−'} {naira(Math.abs(tx.amount))}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      <TopUpSheet open={funding} onClose={() => setFunding(false)} />
    </Screen>
  );
}

function TopUpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const topUp = useTopUpWallet();

  const [selected, setSelected] = useState<number | null>(PRESETS_KOBO[0]);
  const [custom, setCustom] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  // A typed amount always wins over a chip, so the two can never disagree.
  const customKobo = Math.round(Number(custom.replace(/[^0-9.]/g, '')) * 100);
  const amountKobo = custom.trim() ? customKobo : (selected ?? 0);
  const valid = amountKobo >= 1_000 && amountKobo <= 100_000;

  function close() {
    setProblem(null);
    setCustom('');
    setSelected(PRESETS_KOBO[0]);
    onClose();
  }

  async function fund() {
    setProblem(null);
    try {
      const result = await topUp.mutateAsync(amountKobo);
      // On web the tab is already navigating to Paystack; there is no outcome
      // to report and the screen is about to be replaced.
      if (result.status === 'REDIRECTING') return;
      if (result.status === 'SUCCESS') return close();

      setProblem(
        result.status === 'ABANDONED'
          ? 'You closed the payment before it went through. Nothing was charged.'
          : "That payment didn't go through. Nothing was charged."
      );
    } catch (err) {
      // The underlying message is kept rather than swallowed: "Could not start
      // the payment" on its own sent us looking at the server for a failure
      // that was entirely in the browser.
      const detail = err instanceof Error ? err.message : '';
      setProblem(
        err instanceof ApiError
          ? err.message
          : `Could not start the payment.${detail ? ` ${detail}` : ''}`
      );
    }
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <Screen>
        <View className="flex-row items-center px-4 py-3 border-b border-hairline">
          <Text className="text-ink text-[18px] font-bold flex-1">Fund wallet</Text>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="p-2"
          >
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-body text-[15px] mb-3">How much?</Text>
          <View className="flex-row flex-wrap gap-2">
            {PRESETS_KOBO.map((kobo) => {
              const on = !custom.trim() && selected === kobo;
              return (
                <Pressable
                  key={kobo}
                  onPress={() => {
                    setSelected(kobo);
                    setCustom('');
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  className={`px-5 h-11 rounded-full items-center justify-center border-[1.5px] ${
                    on ? 'bg-pink-600 border-pink-600' : 'bg-surface border-transparent'
                  }`}
                >
                  <Text className={`text-[15px] font-semibold ${on ? 'text-white' : 'text-body'}`}>
                    {naira(kobo / 100)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-5">
            <Input
              label="Or another amount"
              value={custom}
              onChangeText={setCustom}
              placeholder="0"
              prefix="₦"
              keyboardType="number-pad"
              helper="Between ₦10 and ₦1,000."
              error={custom.trim() && !valid ? 'Enter an amount between ₦10 and ₦1,000.' : undefined}
            />
          </View>

          <View className="bg-surface rounded-lg p-4 mt-2">
            <Text className="text-body text-[13px] leading-[19px]">
              Amounts are kept small while the wallet is being tested — treat ₦10 as if it were
              ₦10,000. You&apos;ll pay through Paystack and come straight back here.
            </Text>
          </View>

          {__DEV__ ? (
            <View className="bg-surface rounded-lg p-4 mt-3">
              <Text className="text-muted text-[12px] font-semibold mb-1">TEST MODE</Text>
              <Text className="text-muted text-[12px] leading-[18px]">
                Card 4084 0840 8408 4081 · CVV 408 · any future expiry · PIN 0000 · OTP 123456. No
                real money moves on test keys.
              </Text>
            </View>
          ) : null}

          {problem ? <Text className="text-error text-[14px] mt-4">{problem}</Text> : null}
        </ScrollView>

        <StickyBar>
          <Button
            title={valid ? `Pay ${naira(amountKobo / 100)}` : 'Pay'}
            onPress={fund}
            disabled={!valid}
            loading={topUp.isPending}
          />
        </StickyBar>
      </Screen>
    </Modal>
  );
}

/** "Today, 2:31 PM" / "Yesterday" / "12 Aug" — enough to locate a payment. */
function when(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.floor((midnight - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);

  const time = date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}
