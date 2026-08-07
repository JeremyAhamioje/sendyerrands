import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BidCard } from '@/components/BidCard';
import { Badge, Card, Chip, Divider, EmptyState } from '@/components/ui/atoms';
import { IconButton } from '@/components/ui/Button';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useBidRequest, useMarketplaceRequests, useSelectBid } from '@/lib/api/hooks';
import { naira, timeUntil } from '@/lib/format';
import { colors } from '@/lib/theme';

const SORTS = [
  { label: 'Lowest price', value: 'price' },
  { label: 'Fastest', value: 'eta' },
  { label: 'Top rated', value: 'rating' },
] as const;

type SortValue = (typeof SORTS)[number]['value'];

/** Bids received (design.md §11 step 3) — compare vendor bids, select a winner. */
export default function BidsReceived() {
  const router = useRouter();
  const [sort, setSort] = useState<SortValue>('price');

  /**
   * The screen can be opened with an explicit request id, or bare from the
   * marketplace tab. Bare, it falls back to the customer's most recent
   * request — the API already returns them newest first.
   */
  const { id } = useLocalSearchParams<{ id?: string }>();
  const requests = useMarketplaceRequests();
  const requestId = id ?? requests.data?.[0]?.id;

  const { data, isLoading, isError, error, refetch } = useBidRequest(requestId, sort);
  const select = useSelectBid();

  const header = (
    <View className="bg-white">
      <ScreenHeader
        title="Bids received"
        right={
          <IconButton
            icon="help-buoy-outline"
            onPress={() => router.push('/(tabs)/support')}
            accessibilityLabel="Help"
          />
        }
      />
    </View>
  );

  if (requests.isLoading || (requestId && isLoading)) {
    return (
      <Screen className="bg-surface">
        {header}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.pink[600]} />
        </View>
      </Screen>
    );
  }

  if (!requestId) {
    return (
      <Screen className="bg-surface">
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="hammer-outline"
            title="No open requests"
            body="Post what you need and verified vendors will bid for it."
          >
            <Text
              onPress={() => router.push('/marketplace/post-request')}
              className="text-pink-600 text-[15px] font-semibold mt-4"
            >
              Post a request
            </Text>
          </EmptyState>
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen className="bg-surface">
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="alert-circle-outline"
            title="We couldn't load these bids"
            body={error instanceof Error ? error.message : 'Please try again.'}
          >
            <Text onPress={() => refetch()} className="text-pink-600 text-[15px] font-semibold mt-4">
              Try again
            </Text>
          </EmptyState>
        </View>
      </Screen>
    );
  }

  const { request, bids, isOpen } = data;

  return (
    <Screen className="bg-surface">
      {header}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* the request */}
        <Card className="p-4 mb-4">
          <View className="flex-row items-center mb-2.5">
            <Text className="text-muted text-[11px] font-semibold tracking-wide flex-1">
              YOUR REQUEST
            </Text>
            <View className="flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-pink-600 mr-1.5" />
              <Text className="text-pink-600 text-[11px] font-bold">
                {request.bidCount} {request.bidCount === 1 ? 'BID' : 'BIDS'}
              </Text>
            </View>
          </View>

          <Text className="text-ink text-[17px] font-semibold leading-[23px]">{request.title}</Text>
          <Text className="text-muted text-[13px] mt-2">
            Qty {request.quantity} · Deliver to {request.dropoff}
            {request.budget ? ` · Budget ${naira(request.budget)}` : ''}
          </Text>

          <Divider className="my-3" />

          <View className="flex-row items-center">
            <Ionicons
              name={isOpen ? 'time-outline' : 'lock-closed-outline'}
              size={15}
              color={isOpen ? colors.pink[600] : colors.muted}
            />
            <Text
              className={`text-[13px] font-medium ml-1.5 ${isOpen ? 'text-pink-600' : 'text-muted'}`}
            >
              {isOpen
                ? `Bidding closes in ${timeUntil(request.closesAt)} — pick a winner`
                : 'Bidding has closed'}
            </Text>
          </View>
        </Card>

        {/* sort */}
        <View className="flex-row mb-4">
          {SORTS.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              icon={s.value === 'price' ? 'options-outline' : undefined}
              selected={s.value === sort}
              onPress={() => setSort(s.value)}
            />
          ))}
        </View>

        {select.isError ? (
          <View className="bg-error/10 rounded-md p-3.5 mb-3">
            <Text className="text-error text-[13px]">
              {select.error instanceof Error ? select.error.message : 'Could not select that bid.'}
            </Text>
          </View>
        ) : null}

        {/* bids — the server flags the best price, so it stays correct under any sort */}
        {bids.length === 0 ? (
          <Card className="p-6 items-center">
            <Text className="text-ink text-[15px] font-semibold">No bids yet</Text>
            <Text className="text-muted text-[13px] mt-1 text-center">
              Vendors usually respond within a few minutes. This updates on its own.
            </Text>
          </Card>
        ) : (
          bids.map((bid) => (
            <BidCard
              key={bid.id}
              bid={bid}
              closed={!isOpen}
              disabled={select.isPending}
              onSelect={() =>
                select.mutate(
                  { requestId: request.id, bidId: bid.id },
                  {
                    onSuccess: (order) =>
                      router.replace({ pathname: '/track/[id]', params: { id: order.id } }),
                  }
                )
              }
            />
          ))
        )}

        {/* trust note */}
        <View className="flex-row items-start bg-white rounded-md p-3.5 mt-1 border border-hairline">
          <Ionicons name="shield-checkmark-outline" size={17} color={colors.success} />
          <Text className="text-body text-[13px] ml-2.5 flex-1 leading-[18px]">
            Your payment is only authorised when you select a bid, and held until the item is
            delivered. Every vendor here is ID-verified.
          </Text>
        </View>

        {isOpen ? (
          <View className="items-center mt-6">
            <Badge label="Waiting for more bids…" tone="muted" icon="hourglass-outline" />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
