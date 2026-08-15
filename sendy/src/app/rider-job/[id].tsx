import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Badge, Card, Divider, Skeleton } from '@/components/ui/atoms';
import { Button, IconButton } from '@/components/ui/Button';
import { JOB_ROUTE, MapCanvas } from '@/components/ui/MapCanvas';
import { Screen, StickyBar } from '@/components/ui/Screen';
import { naira } from '@/lib/format';
import { useQuery } from '@tanstack/react-query';
import { useAcceptJob } from '@/lib/api/hooks';
import { riderApi } from '@/lib/api/endpoints';
import { toRiderJob } from '@/lib/api/mappers';
import { useApp } from '@/store/app';
import { colors, shadow } from '@/lib/theme';

/** Rider job detail (design.md §10) — pickup/drop, customer, route, payout. */
export default function RiderJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useApp();
  const accept = useAcceptJob();
  const { data: job } = useQuery({
    queryKey: ['rider-job', id],
    queryFn: async () => toRiderJob(await riderApi.job(id!, token!)),
    enabled: Boolean(id && token),
  });

  if (!job) {
    return (
      <Screen edges={[]} className="bg-surface">
        <View className="h-[300px] bg-hairline" />
        <View className="flex-1 bg-white rounded-t-xl -mt-6 p-4">
          <Skeleton className="w-1/2 h-9 mb-4" />
          <Skeleton className="w-full h-24 mb-3" />
          <Skeleton className="w-full h-24" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]} className="bg-surface">
      {/* map */}
      <View className="h-[300px]">
        <MapCanvas
          className="absolute inset-0"
          route={JOB_ROUTE}
          markers={[
            { x: 19, y: 69, icon: 'cube', tone: 'white' },
            { x: 69, y: 23, icon: 'location', tone: 'pink' },
          ]}
        />
        <View className="px-4 pt-12">
          <IconButton icon="arrow-back" tone="white" onPress={() => router.back()} accessibilityLabel="Go back" />
        </View>
      </View>

      {/* sheet */}
      <View className="flex-1 bg-white rounded-t-xl -mt-6" style={shadow.float}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row items-start">
            <View className="flex-1">
              <Text className="text-muted text-[11px] font-semibold tracking-wide">YOU&apos;LL EARN</Text>
              <Text className="text-ink text-[32px] font-bold mt-1">{naira(job.payout)}</Text>
            </View>
            <View className="flex-row items-center bg-pink-50 rounded-full px-3 py-1.5 mt-1">
              <Ionicons name="cube-outline" size={13} color={colors.pink[600]} />
              <Text className="text-pink-700 text-[11px] font-semibold ml-1.5">{job.type}</Text>
            </View>
          </View>

          {/* meta — distance and duration await a maps provider, so they are
              hidden rather than shown as a misleading zero. */}
          <View className="flex-row mt-4">
            {job.distanceKm > 0 ? <Meta icon="navigate-outline" label={`${job.distanceKm} km total`} /> : null}
            {job.minutes > 0 ? <Meta icon="time-outline" label={`~${job.minutes} min`} /> : null}
            <Meta icon="card-outline" label={job.paymentLabel ?? (job.prepaid ? 'Prepaid' : 'Cash')} />
          </View>

          {/* route */}
          <Card className="mt-5">
            <Stop
              tone="pink"
              kicker="PICK-UP"
              name={job.pickupName}
              address={job.pickupAddress}
              connector
            />
            <Divider className="mx-4" />
            <Stop tone="ink" kicker="DROP-OFF" name={job.dropoffName} address={job.dropoffAddress} />
          </Card>

          {/* notes */}
          {job.notes ? (
            <>
              <Text className="text-muted text-[13px] font-semibold mt-5 mb-2.5">
                {job.type === 'Errand' ? 'ERRAND DETAILS' : 'PARCEL DETAILS'}
              </Text>
              <Card className="p-4">
                <Text className="text-body text-[15px] leading-[21px]">{job.notes}</Text>
              </Card>
            </>
          ) : null}

          {!job.prepaid ? (
            <View className="flex-row items-start bg-savings/10 rounded-md p-3.5 mt-4">
              <Ionicons name="cash-outline" size={17} color={colors.savings} />
              <Text className="text-body text-[13px] ml-2.5 flex-1 leading-[18px]">
                Collect {naira(job.payout)} in cash at drop-off. It is deducted from your next
                payout.
              </Text>
            </View>
          ) : null}

          <View className="items-center mt-5">
            <Badge label="Expires in 1:45" tone="muted" icon="hourglass-outline" />
          </View>
        </ScrollView>
      </View>

      <StickyBar>
        {accept.isError ? (
          <View className="bg-error/10 rounded-md p-3 mb-3">
            <Text className="text-error text-[13px]">
              {accept.error instanceof Error
                ? accept.error.message
                : 'Could not take that job — another rider may have claimed it.'}
            </Text>
          </View>
        ) : null}
        <Button
          title={accept.isPending ? 'Claiming…' : 'Accept & start pickup'}
          iconRight="arrow-forward"
          loading={accept.isPending}
          // The job has to be claimed on the SERVER before the active screen
          // opens. Navigating first showed a rider "DELIVERING" a job that was
          // still on the open board for everyone else.
          onPress={() =>
            accept.mutate(job.id, {
              onSuccess: () =>
                router.replace({ pathname: '/rider-active/[id]', params: { id: job.id } }),
            })
          }
        />
      </StickyBar>
    </Screen>
  );
}

function Stop({
  tone,
  kicker,
  name,
  address,
  connector = false,
}: {
  tone: 'pink' | 'ink';
  kicker: string;
  name: string;
  address: string;
  connector?: boolean;
}) {
  return (
    <View className="flex-row items-start p-4">
      <View className="items-center w-5 pt-1">
        {tone === 'pink' ? (
          <View className="w-2.5 h-2.5 rounded-full bg-pink-600" />
        ) : (
          <Ionicons name="location" size={14} color={colors.ink} />
        )}
        {connector ? <View className="w-[1.5px] h-6 bg-hairline mt-1" /> : null}
      </View>
      <View className="flex-1 ml-1">
        <Text className="text-muted text-[11px] font-semibold tracking-wide">{kicker}</Text>
        <Text className="text-ink text-[15px] font-semibold mt-0.5">{name}</Text>
        <Text className="text-muted text-[13px] mt-0.5">{address}</Text>
      </View>
      <IconButton icon="call-outline" size={36} accessibilityLabel={`Call ${kicker}`} />
    </View>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View className="flex-row items-center bg-surface rounded-md px-3 py-2 mr-2">
      <Ionicons name={icon} size={13} color={colors.body} />
      <Text className="text-body text-[13px] font-medium ml-1.5">{label}</Text>
    </View>
  );
}
