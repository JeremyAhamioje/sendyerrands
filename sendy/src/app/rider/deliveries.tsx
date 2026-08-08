import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { JobCard } from '@/components/JobCard';
import { EmptyState, Skeleton } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { QueryError } from '@/components/ui/QueryError';
import { Screen, Segmented } from '@/components/ui/Screen';
import { useRiderOrders } from '@/lib/api/hooks';

/**
 * The rider's own deliveries.
 *
 * Separate from Jobs, which is the open board of unclaimed work. Accepting a
 * job removed it from that board and delivering removed it from everywhere, so
 * a rider had nowhere to see what they were carrying or what they had already
 * done — and no way to check a payout against the trip that earned it.
 */
export default function RiderDeliveries() {
  const router = useRouter();
  const [tab, setTab] = useState('Active');

  const status = tab === 'Active' ? 'active' : 'completed';
  const { data: orders = [], isLoading, isError, error, refetch } = useRiderOrders(status);

  return (
    <Screen>
      <View className="px-4 py-3">
        <Text className="text-ink text-[24px] font-display">My deliveries</Text>
      </View>

      <Segmented options={['Active', 'Completed']} value={tab} onChange={setTab} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="w-full h-[150px] mb-3" />)
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} noun="your deliveries" />
        ) : orders.length ? (
          orders.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPress={() =>
                // An active delivery opens the step-through screen; a finished
                // one has no next step, so it opens read-only detail instead.
                status === 'active'
                  ? router.push({ pathname: '/rider-active/[id]', params: { id: job.id } })
                  : router.push({ pathname: '/rider-job/[id]', params: { id: job.id } })
              }
            />
          ))
        ) : (
          <EmptyState
            icon={status === 'active' ? 'bicycle-outline' : 'checkmark-done-outline'}
            title={status === 'active' ? 'Nothing on the go' : 'No completed trips yet'}
            body={
              status === 'active'
                ? 'Jobs you accept show up here until you deliver them.'
                : 'Once you complete a delivery it moves here, with what it paid.'
            }
          >
            {status === 'active' ? (
              <Button
                title="Find work"
                fullWidth={false}
                onPress={() => router.push('/rider/jobs')}
              />
            ) : null}
          </EmptyState>
        )}
      </ScrollView>
    </Screen>
  );
}
