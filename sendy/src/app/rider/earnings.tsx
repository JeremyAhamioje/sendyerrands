import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, Divider, Skeleton } from '@/components/ui/atoms';
import { IconButton } from '@/components/ui/Button';
import { Screen, Segmented } from '@/components/ui/Screen';
import type { ApiPayout } from '@/lib/api/endpoints';
import { naira } from '@/lib/format';
import { useRiderEarnings, useRiderMe, useRiderPayouts } from '@/lib/api/hooks';
import { colors } from '@/lib/theme';

/** How each payout state reads to the person waiting on the money. */
const PAYOUT_STATES: Record<
  ApiPayout['status'],
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  PENDING: { label: 'Payout starting', icon: 'ellipsis-horizontal-circle-outline', color: colors.muted },
  PROCESSING: { label: 'Payout on the way', icon: 'time-outline', color: colors.savings },
  SUCCESS: { label: 'Paid out', icon: 'checkmark-circle-outline', color: colors.success },
  FAILED: { label: "Payout didn't go through", icon: 'close-circle-outline', color: colors.error },
  REVERSED: { label: 'Payout returned', icon: 'return-down-back-outline', color: colors.error },
};

/** "Today" / "Yesterday" / "12 Aug" — enough to match against a bank alert. */
function when(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return `Today, ${date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

/**
 * Earnings & payouts (design.md §10) — dark balance card, week chart, history.
 *
 * The history below used to be three invented payouts to "GTBank ••4471", and
 * the card promised a weekly auto-payout that nothing scheduled. Both are gone:
 * payouts are released by the team, and this says so rather than naming a day
 * it cannot keep.
 */
export default function RiderEarnings() {
  const router = useRouter();
  const [range, setRange] = useState('This week');
  const apiRange = range === 'Today' ? 'today' : range === 'This month' ? 'month' : 'week';

  const { data } = useRiderEarnings(apiRange);
  const { data: rider } = useRiderMe();
  const { data: payouts = [], isLoading: payoutsLoading } = useRiderPayouts();

  const EARNINGS = {
    payable: data?.payable ?? 0,
    held: data?.held ?? 0,
    holdHours: data?.holdHours ?? 24,
    weekTotal: data?.total ?? 0,
    trips: data?.trips ?? 0,
    rating: data?.rating ?? 5,
    onlineHours: '—',
    acceptance: '—',
    week: data?.week ?? [],
  };
  const hasAccount = Boolean(rider?.bankAccountNo);
  const peak = Math.max(...EARNINGS.week.map((d) => d.value));

  return (
    <Screen>
      <View className="flex-row items-center px-4 py-3">
        <Text className="text-ink text-[24px] font-display flex-1">Earnings</Text>
        <IconButton icon="calendar-outline" accessibilityLabel="Pick a date range" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* balance */}
        <View className="bg-ink rounded-lg p-5">
          <Text className="text-white/70 text-[13px]">Ready to be paid out</Text>
          <Text className="text-white text-[32px] font-bold mt-1">{naira(EARNINGS.payable)}</Text>

          {/* Held money is not missing money. Naming it stops riders counting a
              delivery twice and then asking where it went. */}
          {EARNINGS.held > 0 ? (
            <View className="flex-row items-center mt-3">
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text className="text-white/60 text-[11px] ml-1.5">
                {naira(EARNINGS.held)} still clearing — earnings are ready {EARNINGS.holdHours}h
                after delivery
              </Text>
            </View>
          ) : null}

          {/* No "Cash out" button: riders cannot release their own payouts, and
              a button that opens a support ticket is worse than no button. */}
          {hasAccount ? (
            <View className="flex-row items-center mt-3">
              <Ionicons name="business-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text className="text-white/60 text-[11px] ml-1.5">
                Paid to {rider?.bankName} ••{rider?.bankAccountNo?.slice(-4)}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/rider/payout-account')}
              accessibilityRole="button"
              className="flex-row items-center mt-4 bg-white/15 rounded-lg px-3 py-2.5"
            >
              <Ionicons name="warning-outline" size={15} color={colors.white} />
              <Text className="text-white text-[12px] font-semibold ml-2 flex-1">
                Add your bank account so we can pay you
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.white} />
            </Pressable>
          )}
        </View>

        {/* range */}
        <View className="-mx-4 mt-5">
          <Segmented options={['Today', 'This week', 'This month']} value={range} onChange={setRange} />
        </View>

        {/* chart */}
        <Card className="p-4 mt-5">
          <View className="flex-row items-center mb-5">
            <Text className="text-ink text-[15px] font-bold flex-1">{range}</Text>
            <Text className="text-ink text-[17px] font-bold">{naira(EARNINGS.weekTotal)}</Text>
          </View>

          <View className="flex-row items-end justify-between h-[132px]">
            {EARNINGS.week.map((d) => {
              const isPeak = d.value === peak;
              return (
                <View key={d.day} className="flex-1 items-center">
                  <View
                    style={{ height: Math.max(8, (d.value / peak) * 108) }}
                    className={`w-6 rounded-t-md ${isPeak ? 'bg-pink-600' : 'bg-pink-100'}`}
                  />
                  <Text
                    className={`text-[11px] mt-2 ${isPeak ? 'text-pink-600 font-bold' : 'text-muted'}`}
                  >
                    {d.day}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* stats */}
        <View className="flex-row flex-wrap justify-between mt-4">
          <Stat icon="git-network-outline" value={`${EARNINGS.trips}`} label="Trips" />
          <Stat icon="time-outline" value={EARNINGS.onlineHours} label="Online" />
          <Stat icon="star-outline" value={`${EARNINGS.rating}`} label="Rating" />
          <Stat icon="speedometer-outline" value={EARNINGS.acceptance} label="Acceptance" />
        </View>

        {/* payout history */}
        <Text className="text-muted text-[13px] font-semibold mt-6 mb-2.5">PAYOUT HISTORY</Text>
        <Card>
          {payoutsLoading ? (
            <View className="p-4">
              <Skeleton className="w-full h-12" />
            </View>
          ) : payouts.length === 0 ? (
            <View className="px-4 py-6">
              <Text className="text-muted text-[14px] text-center leading-[20px]">
                No payouts yet. Earnings are released by our team once they clear, and every one
                will be listed here.
              </Text>
            </View>
          ) : (
            payouts.map((p, i) => {
              const state = PAYOUT_STATES[p.status];
              return (
                <View key={p.id}>
                  {i > 0 ? <Divider className="mx-4" /> : null}
                  <View className="flex-row items-center px-4 py-3.5">
                    <View
                      className="w-9 h-9 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: `${state.color}1A` }}
                    >
                      <Ionicons name={state.icon} size={17} color={state.color} />
                    </View>
                    <View className="flex-1 pr-2">
                      <Text className="text-ink text-[15px] font-medium">{state.label}</Text>
                      <Text className="text-muted text-[13px] mt-0.5">
                        {when(p.settledAt ?? p.createdAt)}
                        {p.bankName ? ` · ${p.bankName} ••${p.bankAccountNo?.slice(-4)}` : ''}
                      </Text>
                      {/* Riders chase failed payouts. Saying why up front is
                          the difference between a support call and a re-run. */}
                      {p.failureReason ? (
                        <Text className="text-error text-[12px] mt-1">{p.failureReason}</Text>
                      ) : null}
                    </View>
                    <Text className="text-ink text-[15px] font-bold">{naira(p.amountKobo / 100)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <Card className="w-[48%] p-4 mb-3">
      <View className="w-8 h-8 rounded-full bg-pink-50 items-center justify-center mb-3">
        <Ionicons name={icon} size={16} color={colors.pink[600]} />
      </View>
      <Text className="text-ink text-[20px] font-bold">{value}</Text>
      <Text className="text-muted text-[13px] mt-0.5">{label}</Text>
    </Card>
  );
}
