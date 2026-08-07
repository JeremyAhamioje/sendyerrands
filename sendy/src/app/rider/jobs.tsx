import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { JobCard } from '@/components/JobCard';
import { Badge, Chip } from '@/components/ui/atoms';
import { IconButton } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useRiderJobs, useRiderMe } from '@/lib/api/hooks';
import { colors } from '@/lib/theme';

const FILTERS = ['Nearest', 'Highest pay', 'All types'];

/** Available jobs list (design.md §10) — distance, payout, type. */
export default function RiderJobs() {
  const router = useRouter();
  const [filter, setFilter] = useState('Nearest');
  const { data: riderMe } = useRiderMe();
  const { data: RIDER_JOBS = [] } = useRiderJobs(filter === 'Highest pay' ? 'payout' : 'nearest');
  const RIDER = { zone: riderMe?.zone ?? 'Your area' };

  const jobs = [...RIDER_JOBS].sort((a, b) =>
    filter === 'Highest pay' ? b.payout - a.payout : a.distanceKm - b.distanceKm
  );

  return (
    <Screen>
      <View className="flex-row items-center px-4 py-3">
        <Text className="text-ink text-[24px] font-display flex-1">Available jobs</Text>
        <View className="mr-2">
          <Badge label="Online" tone="success" icon="ellipse" />
        </View>
        <IconButton icon="options-outline" accessibilityLabel="Filters" />
      </View>

      <View className="flex-row items-center px-4 pb-2">
        <Ionicons name="location-outline" size={14} color={colors.muted} />
        <Text className="text-muted text-[13px] ml-1.5">
          {RIDER.zone} · {RIDER_JOBS.length} jobs within 5 km
        </Text>
      </View>

      <View className="py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={f}
              icon={f === 'Nearest' ? 'navigate-outline' : undefined}
              selected={f === filter}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onPress={() => router.push({ pathname: '/rider-job/[id]', params: { id: job.id } })}
            onAccept={() => router.push({ pathname: '/rider-job/[id]', params: { id: job.id } })}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}
