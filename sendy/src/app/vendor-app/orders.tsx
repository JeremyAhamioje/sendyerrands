import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';

import { Badge, Card, Divider, EmptyState, Skeleton } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { QueryError } from '@/components/ui/QueryError';
import { Screen, Segmented } from '@/components/ui/Screen';
import type { ApiVendorOrder } from '@/lib/api/endpoints';
import { useRespondToOrder, useVendorOrders } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import { colors } from '@/lib/theme';

const TABS = ['New', 'Active', 'Done'] as const;
const STATUS = { New: 'new', Active: 'active', Done: 'history' } as const;

/** Incoming orders — accept them, or say you cannot fulfil them. */
export default function VendorOrders() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('New');
  const { data: orders = [], isLoading, isError, error, refetch } = useVendorOrders(STATUS[tab]);

  return (
    <Screen>
      <View className="px-4 py-3">
        <Text className="text-ink text-[24px] font-display">Orders</Text>
      </View>

      <Segmented options={[...TABS]} value={tab} onChange={(v) => setTab(v as (typeof TABS)[number])} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="w-full h-40 mb-3" />)
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} noun="your orders" />
        ) : orders.length ? (
          orders.map((order) => <OrderCard key={order.id} order={order} showActions={tab === 'New'} />)
        ) : (
          <EmptyState
            icon={tab === 'New' ? 'notifications-outline' : 'receipt-outline'}
            title={
              tab === 'New' ? 'No new orders' : tab === 'Active' ? 'Nothing in progress' : 'No past orders'
            }
            body={
              tab === 'New'
                ? 'Orders waiting for you to accept show up here.'
                : tab === 'Active'
                  ? 'Orders you have accepted appear here until they are delivered.'
                  : 'Delivered and cancelled orders are kept here.'
            }
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function OrderCard({ order, showActions }: { order: ApiVendorOrder; showActions: boolean }) {
  const respond = useRespondToOrder();
  const [error, setError] = useState<string | null>(null);

  const customerName = order.customer
    ? `${order.customer.firstName} ${order.customer.lastName}`
    : 'Customer';

  return (
    <Card className="p-4 mb-3">
      <View className="flex-row items-center">
        <Text className="text-ink text-[15px] font-bold flex-1">{order.reference}</Text>
        <Badge
          label={order.status.toLowerCase().replace(/_/g, ' ')}
          tone={order.status === 'PLACED' ? 'info' : order.status === 'DELIVERED' ? 'success' : 'muted'}
        />
      </View>

      <View className="mt-3">
        {order.items.map((item) => (
          <View key={item.id} className="flex-row mb-1.5">
            <Text className="text-body text-[14px] w-8">{item.quantity}×</Text>
            <View className="flex-1">
              <Text className="text-ink text-[14px]">{item.name}</Text>
              {/* A note is an instruction the kitchen must see — "no pepper"
                  buried in a drawer is a remake and a refund. */}
              {item.note ? (
                <Text className="text-pink-600 text-[12px] mt-0.5">{item.note}</Text>
              ) : null}
            </View>
            <Text className="text-body text-[14px]">{naira(item.unitPriceKobo / 100)}</Text>
          </View>
        ))}
      </View>

      <Divider className="my-3" />

      <View className="flex-row">
        <Text className="text-muted text-[13px] flex-1">Your total</Text>
        <Text className="text-ink text-[15px] font-bold">{naira(order.subtotalKobo / 100)}</Text>
      </View>

      <View className="flex-row items-center mt-3">
        <Ionicons name="person-outline" size={14} color={colors.muted} />
        <Text className="text-muted text-[13px] ml-1.5 flex-1" numberOfLines={1}>
          {customerName}
        </Text>
        {order.customer?.phone ? (
          <Text
            onPress={() => Linking.openURL(`tel:${order.customer!.phone}`)}
            className="text-pink-600 text-[13px] font-semibold"
          >
            Call
          </Text>
        ) : null}
      </View>

      {order.rider ? (
        <View className="flex-row items-center mt-1.5">
          <Ionicons name="bicycle-outline" size={14} color={colors.muted} />
          <Text className="text-muted text-[13px] ml-1.5 flex-1" numberOfLines={1}>
            {order.rider.firstName} {order.rider.lastName} · picking up
          </Text>
        </View>
      ) : null}

      {error ? <Text className="text-error text-[13px] mt-2">{error}</Text> : null}

      {showActions ? (
        <View className="flex-row mt-4">
          <View className="flex-1">
            <Button
              title="Can't fulfil"
              variant="secondary"
              loading={respond.isPending}
              onPress={() =>
                respond.mutate(
                  { id: order.id, accept: false },
                  { onError: (e) => setError(e instanceof Error ? e.message : 'Could not reject that.') }
                )
              }
            />
          </View>
          <View className="w-3" />
          <View className="flex-1">
            <Button
              title="Accept"
              loading={respond.isPending}
              onPress={() =>
                respond.mutate(
                  { id: order.id, accept: true },
                  { onError: (e) => setError(e instanceof Error ? e.message : 'Could not accept that.') }
                )
              }
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}
