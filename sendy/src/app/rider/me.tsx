import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Badge, Card, ListRow, Verified } from '@/components/ui/atoms';
import { Screen } from '@/components/ui/Screen';
import { useRiderMe } from '@/lib/api/hooks';
import { colors } from '@/lib/theme';

/** Rider profile — verification status, vehicle, documents, payout account. */
export default function RiderMe() {
  const router = useRouter();
  const { data: rider } = useRiderMe();
  const RIDER = {
    initials: rider ? (rider.firstName[0] + rider.lastName[0]).toUpperCase() : '–',
    name: rider ? rider.firstName + ' ' + rider.lastName : 'Rider',
    rating: rider?.rating ?? 5,
    plate: rider?.plateNumber ?? '—',
    zone: rider?.zone ?? '—',
  };
  const EARNINGS = { trips: rider?.completedJobs ?? 0 };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 py-3">
          <Text className="text-ink text-[24px] font-display">Me</Text>
        </View>

        {/* identity */}
        <View className="flex-row items-center px-4 pb-5">
          <View className="w-16 h-16 rounded-full bg-pink-100 items-center justify-center">
            <Text className="text-pink-700 text-[20px] font-bold">{RIDER.initials}</Text>
          </View>
          <View className="flex-1 ml-4">
            <View className="flex-row items-center">
              <Text className="text-ink text-[20px] font-bold mr-1.5">{RIDER.name}</Text>
              <Verified size={17} />
            </View>
            <View className="flex-row items-center mt-1">
              <Ionicons name="star" size={13} color={colors.star} />
              <Text className="text-muted text-[13px] ml-1">
                {RIDER.rating} · {EARNINGS.trips} trips this week
              </Text>
            </View>
          </View>
        </View>

        {/* verification */}
        <View className="px-4">
          <Card className="flex-row items-center p-4">
            <View className="w-10 h-10 rounded-full bg-success/10 items-center justify-center mr-3">
              <Ionicons name="shield-checkmark" size={19} color={colors.success} />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-[15px] font-semibold">Verification complete</Text>
              <Text className="text-muted text-[13px] mt-0.5">
                ID, licence and guarantor approved
              </Text>
            </View>
            <Badge label="Active" tone="success" />
          </Card>
        </View>

        {/* vehicle */}
        <Text className="text-muted text-[13px] font-semibold px-4 mt-6 mb-2">VEHICLE</Text>
        <Card className="mx-4 overflow-hidden">
          <ListRow icon="bicycle-outline" label="Motorbike" value={RIDER.plate} />
          <ListRow icon="map-outline" label="Operating zone" value={RIDER.zone} last />
        </Card>

        {/* documents */}
        <Text className="text-muted text-[13px] font-semibold px-4 mt-6 mb-2">DOCUMENTS</Text>
        <Card className="mx-4 overflow-hidden">
          <ListRow
            icon="document-text-outline"
            label="Rider documents"
            value="3 approved"
            onPress={() => router.push('/rider-verify')}
          />
          <ListRow icon="card-outline" label="Payout account" value="GTBank ••4471" last />
        </Card>

        {/* settings */}
        <Text className="text-muted text-[13px] font-semibold px-4 mt-6 mb-2">SETTINGS</Text>
        <Card className="mx-4 overflow-hidden">
          <ListRow icon="notifications-outline" label="Job alerts" value="On" />
          <ListRow icon="help-buoy-outline" label="Rider support" />
          <ListRow
            icon="swap-horizontal-outline"
            label="Switch to customer app"
            onPress={() => router.replace('/(tabs)/home')}
          />
          <ListRow icon="log-out-outline" label="Log out" danger last onPress={() => router.replace('/')} />
        </Card>

        <Text className="text-muted text-[11px] text-center mt-7">Sendy Rider v1.0.0 (MVP)</Text>
      </ScrollView>
    </Screen>
  );
}
