import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge, Card, EmptyState, Skeleton } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen, Segmented } from '@/components/ui/Screen';
import { QueryError } from '@/components/ui/QueryError';
import { Thumb } from '@/components/ui/Thumb';
import { useOrders } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import type { Order } from '@/lib/mock';
import { colors } from '@/lib/theme';

/** Orders (design.md §10) — Active and History tabs. */
export default function Orders() {
  const router = useRouter();
  const [tab, setTab] = useState('Active');
  const { data: orders = [], isLoading, isError, error, refetch } = useOrders(
    tab === 'Active' ? 'active' : 'history'
  );

  const list = orders;

  return (
    <Screen>
      <View className="px-4 py-3">
        <Text className="text-ink text-[24px] font-display">Orders</Text>
      </View>

      <Segmented options={['Active', 'History']} value={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="w-full h-[132px] mb-3" />)
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} noun="your orders" />
        ) : list.length ? (
          list.map((order) => <OrderRow key={order.id} order={order} router={router} />)
        ) : (
          <EmptyState
            icon="receipt-outline"
            title={tab === 'Active' ? 'No active orders' : 'Nothing here yet'}
            body={
              tab === 'Active'
                ? 'When you place an order it shows up here with live tracking.'
                : 'Your completed and cancelled orders will be listed here.'
            }
          >
            <Button title="Start an order" fullWidth={false} onPress={() => router.push('/(tabs)/home')} />
          </EmptyState>
        )}
      </ScrollView>
    </Screen>
  );
}

function OrderRow({ order, router }: { order: Order; router: ReturnType<typeof useRouter> }) {
  const active = order.status === 'active';
  const tone = order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'error' : 'pink';

  return (
    <Pressable
      onPress={() =>
        active
          ? router.push({ pathname: '/track/[id]', params: { id: order.id } })
          : router.push({ pathname: '/track/[id]', params: { id: order.id } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${order.vendor}, ${order.statusLabel}`}
    >
      <Card className="p-3.5 mb-3">
        <View className="flex-row">
          <Thumb data={order.thumb} className="w-14 h-14" iconSize={22} />
          <View className="flex-1 ml-3">
            <View className="flex-row items-start">
              <Text className="text-ink text-[15px] font-semibold flex-1 pr-2" numberOfLines={1}>
                {order.vendor}
              </Text>
              <Badge label={order.type} tone="muted" />
            </View>
            <Text className="text-muted text-[13px] mt-1">
              {order.reference} · {order.itemCount} item{order.itemCount > 1 ? 's' : ''} · {order.placedAt}
            </Text>
            <View className="flex-row items-center mt-2">
              <Badge
                label={order.statusLabel}
                tone={tone}
                icon={
                  order.status === 'delivered'
                    ? 'checkmark-circle'
                    : order.status === 'cancelled'
                      ? 'close-circle'
                      : 'bicycle'
                }
              />
              <View className="flex-1" />
              <Text className="text-ink text-[15px] font-bold">{naira(order.total)}</Text>
            </View>
          </View>
        </View>

        {active ? (
          <View className="flex-row items-center mt-3 pt-3 border-t border-hairline">
            <Ionicons name="navigate-circle-outline" size={17} color={colors.pink[600]} />
            <Text className="text-pink-600 text-[13px] font-semibold ml-1.5 flex-1">Track this order</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.pink[600]} />
          </View>
        ) : (
          <View className="flex-row items-center mt-3 pt-3 border-t border-hairline">
            <Ionicons name="refresh-outline" size={17} color={colors.body} />
            <Text className="text-body text-[13px] font-semibold ml-1.5 flex-1">Order again</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.muted} />
          </View>
        )}
      </Card>
    </Pressable>
  );
}
