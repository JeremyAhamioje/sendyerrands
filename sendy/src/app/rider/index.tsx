import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { JobCard } from '@/components/JobCard';
import { SectionHeader } from '@/components/ui/atoms';
import { IconButton } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useRiderJobs, useRiderMe, useSetAvailability } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import { colors } from '@/lib/theme';

/** Rider home (design.md §10) — availability toggle + today's numbers. */
export default function RiderHome() {
  const router = useRouter();
  const { data: rider } = useRiderMe();
  const { data: jobs = [] } = useRiderJobs();
  const setAvailability = useSetAvailability();
  const online = rider?.isOnline ?? false;
  const RIDER = {
    initials: rider ? (rider.firstName[0] + rider.lastName[0]).toUpperCase() : '–',
    name: rider ? rider.firstName + ' ' + rider.lastName : 'Rider',
    zone: rider?.zone ?? 'your area',
    todayEarnings: rider?.todayEarnings ?? 0,
    todayTrips: rider?.todayTrips ?? 0,
    onlineTime: rider?.completedJobs != null ? String(rider.completedJobs) : '—',
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* header */}
        <View className="flex-row items-center px-4 py-3">
          <View className="w-11 h-11 rounded-full bg-pink-100 items-center justify-center">
            <Text className="text-pink-700 text-[15px] font-bold">{RIDER.initials}</Text>
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-muted text-[13px]">Good afternoon</Text>
            <Text className="text-ink text-[17px] font-bold">{RIDER.name}</Text>
          </View>
          <IconButton icon="notifications-outline" badge accessibilityLabel="Notifications" />
        </View>

        {/* online card */}
        <View className="px-4">
          <LinearGradient
            colors={online ? [colors.pink[600], colors.pink[900]] : ['#4A4652', '#191420']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 16, padding: 18 }}
          >
            <View className="flex-row items-center">
              <View className="flex-1 flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-white mr-2" />
                <Text className="text-white text-[17px] font-bold">
                  You&apos;re {online ? 'online' : 'offline'}
                </Text>
              </View>
              <Pressable
                onPress={() => setAvailability.mutate(!online)}
                accessibilityRole="switch"
                accessibilityState={{ checked: online }}
                accessibilityLabel="Toggle availability"
                className={`w-14 h-8 rounded-full p-1 ${online ? 'bg-white/30' : 'bg-white/20'}`}
              >
                <View className={`w-6 h-6 rounded-full bg-white ${online ? 'ml-auto' : ''}`} />
              </Pressable>
            </View>

            <Text className="text-white/80 text-[13px] mt-1.5">
              {online ? `Receiving requests in ${RIDER.zone}` : 'Go online to receive requests'}
            </Text>

            <View className="flex-row mt-5">
              <Metric value={naira(RIDER.todayEarnings)} label="Today" />
              <View className="w-px bg-white/25 mx-4" />
              <Metric value={`${RIDER.todayTrips}`} label="Trips" />
              <View className="w-px bg-white/25 mx-4" />
              <Metric value={RIDER.onlineTime} label="Online" />
            </View>
          </LinearGradient>
        </View>

        {/* available jobs */}
        <View className="pt-6">
          <SectionHeader
            title="Available near you"
            actionLabel="See all"
            onAction={() => router.push('/rider/jobs')}
          />
          <View className="px-4">
            {online ? (
              jobs.slice(0, 3).map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  compact
                  onPress={() => router.push({ pathname: '/rider-job/[id]', params: { id: job.id } })}
                />
              ))
            ) : (
              <View className="items-center py-12">
                <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
                  <Ionicons name="moon-outline" size={32} color={colors.muted} />
                </View>
                <Text className="text-ink text-[17px] font-semibold">You&apos;re offline</Text>
                <Text className="text-muted text-[15px] text-center mt-1.5">
                  Flip the switch above to start receiving jobs.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text className="text-white text-[18px] font-bold">{value}</Text>
      <Text className="text-white/75 text-[11px] mt-0.5">{label}</Text>
    </View>
  );
}
