import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Card, Divider } from '@/components/ui/atoms';
import { Button, IconButton } from '@/components/ui/Button';
import { Screen, Segmented } from '@/components/ui/Screen';
import { naira } from '@/lib/format';
import { useRiderEarnings } from '@/lib/api/hooks';
import { colors } from '@/lib/theme';

const PAYOUTS = [
  { id: 'p1', label: 'Weekly payout', sub: 'Fri, 26 Jul · GTBank ••4471', amount: 51200 },
  { id: 'p2', label: 'Instant cash out', sub: 'Wed, 24 Jul · GTBank ••4471', amount: 18000 },
  { id: 'p3', label: 'Weekly payout', sub: 'Fri, 19 Jul · GTBank ••4471', amount: 47650 },
];

/** Earnings & payouts (design.md §10) — dark balance card, week chart, history. */
export default function RiderEarnings() {
  const [range, setRange] = useState('This week');
  const apiRange = range === 'Today' ? 'today' : range === 'This month' ? 'month' : 'week';
  const { data } = useRiderEarnings(apiRange);
  const EARNINGS = {
    available: data?.available ?? 0,
    weekTotal: data?.total ?? 0,
    trips: data?.trips ?? 0,
    rating: data?.rating ?? 5,
    onlineHours: '—',
    acceptance: '—',
    nextPayout: 'Friday',
    week: data?.week ?? [],
  };
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
          <View className="flex-row items-start">
            <View className="flex-1">
              <Text className="text-white/70 text-[13px]">Available to cash out</Text>
              <Text className="text-white text-[32px] font-bold mt-1">
                {naira(EARNINGS.available)}
              </Text>
            </View>
            <View className="w-[132px]">
              {/* no icon — the label wraps at this width once a glyph is added */}
              <Button title="Cash out" />
            </View>
          </View>
          <View className="flex-row items-center mt-4">
            <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text className="text-white/60 text-[11px] ml-1.5">
              Next auto-payout: {EARNINGS.nextPayout}
            </Text>
          </View>
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
          {PAYOUTS.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <Divider className="mx-4" /> : null}
              <View className="flex-row items-center px-4 py-3.5">
                <View className="w-9 h-9 rounded-full bg-success/10 items-center justify-center mr-3">
                  <Ionicons name="checkmark-circle-outline" size={17} color={colors.success} />
                </View>
                <View className="flex-1">
                  <Text className="text-ink text-[15px] font-medium">{p.label}</Text>
                  <Text className="text-muted text-[13px] mt-0.5">{p.sub}</Text>
                </View>
                <Text className="text-ink text-[15px] font-bold">{naira(p.amount)}</Text>
              </View>
            </View>
          ))}
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
