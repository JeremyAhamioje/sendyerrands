import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { VendorCard } from '@/components/VendorCard';
import { EmptyState, Skeleton } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { QueryError } from '@/components/ui/QueryError';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useFavourites } from '@/lib/api/hooks';

/** Vendors the customer saved. The other half of the heart on VendorCard. */
export default function Favourites() {
  const router = useRouter();
  const { data: vendors = [], isLoading, isError, error, refetch } = useFavourites();

  return (
    <Screen>
      <ScreenHeader title="Favourites" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="w-full h-56 mb-5" />)
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} noun="your favourites" />
        ) : vendors.length ? (
          vendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
            />
          ))
        ) : (
          <EmptyState
            icon="heart-outline"
            title="No favourites yet"
            body="Tap the heart on any vendor to save it here for next time."
          >
            <Button
              title="Browse vendors"
              fullWidth={false}
              onPress={() => router.push('/(tabs)/home')}
            />
          </EmptyState>
        )}
      </ScrollView>
    </Screen>
  );
}
