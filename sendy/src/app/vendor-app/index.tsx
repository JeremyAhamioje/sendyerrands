import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components/ui/atoms';
import { Screen } from '@/components/ui/Screen';
import { useSetVendorOpen, useVendorMe, useVendorOrders } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import { koboToNaira } from '@/lib/api/mappers';
import { colors } from '@/lib/theme';

/** Vendor home — open/closed, today's numbers, and anything awaiting a decision. */
export default function VendorHome() {
  const router = useRouter();
  const { data: vendor } = useVendorMe();
  const { data: newOrders = [] } = useVendorOrders('new');
  const setOpen = useSetVendorOpen();

  const open = vendor?.isOpen ?? false;
  const verified = vendor?.isVerified ?? false;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View className="flex-row items-center px-4 py-3">
          <View className="w-11 h-11 rounded-full bg-pink-100 items-center justify-center">
            <Ionicons name="storefront" size={20} color={colors.pink[700]} />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-ink text-[17px] font-bold" numberOfLines={1}>
              {vendor?.name ?? 'Your shop'}
            </Text>
            <Text className="text-muted text-[13px] mt-0.5">{vendor?.phone ?? '—'}</Text>
          </View>
        </View>

        {!verified ? (
          <View className="mx-4 mb-1 flex-row items-center rounded-md bg-pink-50 px-3.5 py-3">
            <Ionicons name="shield-outline" size={20} color={colors.pink[600]} />
            <View className="flex-1 ml-2.5">
              <Text className="text-pink-700 text-[14px] font-semibold">Waiting on verification</Text>
              <Text className="text-pink-700/80 text-[12px] mt-0.5 leading-[16px]">
                Customers can’t see your shop yet. Add your listings now so you’re ready.
              </Text>
            </View>
          </View>
        ) : null}

        <View className="px-4">
          <LinearGradient
            colors={open ? [colors.pink[600], colors.pink[900]] : ['#4A4652', '#191420']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 16, padding: 18 }}
          >
            <View className="flex-row items-center">
              <View className="flex-1 flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-white mr-2" />
                <Text className="text-white text-[17px] font-bold">
                  {open ? 'Open for orders' : 'Closed'}
                </Text>
              </View>
              <Pressable
                onPress={() => setOpen.mutate(!open)}
                disabled={!verified}
                accessibilityRole="switch"
                accessibilityState={{ checked: open, disabled: !verified }}
                accessibilityLabel="Toggle open for orders"
                className={`w-14 h-8 rounded-full p-1 ${
                  !verified ? 'bg-white/10' : open ? 'bg-white/30' : 'bg-white/20'
                }`}
              >
                <View
                  className={`w-6 h-6 rounded-full ${verified ? 'bg-white' : 'bg-white/40'} ${
                    open ? 'ml-auto' : ''
                  }`}
                />
              </Pressable>
            </View>

            {/* The server refuses to open an unverified shop, so say why rather
                than leaving a switch that silently does nothing. */}
            <Text className="text-white/80 text-[13px] mt-1.5">
              {!verified
                ? 'You can open once Sendy Errands has verified your business.'
                : open
                  ? 'Customers can order from you now.'
                  : 'Customers can see you but cannot order.'}
            </Text>

            <View className="flex-row mt-5">
              <Metric value={naira(koboToNaira(vendor?.today.salesKobo))} label="Today" />
              <View className="w-px bg-white/25 mx-4" />
              <Metric value={`${vendor?.today.orders ?? 0}`} label="Orders" />
              <View className="w-px bg-white/25 mx-4" />
              <Metric value={`${vendor?._count.products ?? 0}`} label="Listings" />
            </View>
          </LinearGradient>
        </View>

        <View className="px-4 pt-6">
          <Text className="text-ink text-[20px] font-bold mb-3">
            {newOrders.length > 0 ? 'Needs your answer' : 'Nothing waiting'}
          </Text>

          {newOrders.length > 0 ? (
            newOrders.slice(0, 3).map((order) => (
              <Pressable
                key={order.id}
                accessibilityRole="button"
                onPress={() => router.push('/vendor-app/orders')}
              >
                <Card className="p-4 mb-3">
                  <View className="flex-row items-center">
                    <Text className="text-ink text-[15px] font-semibold flex-1">
                      {order.reference}
                    </Text>
                    <Text className="text-ink text-[15px] font-bold">
                      {naira(koboToNaira(order.subtotalKobo))}
                    </Text>
                  </View>
                  <Text className="text-muted text-[13px] mt-1" numberOfLines={1}>
                    {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </Text>
                </Card>
              </Pressable>
            ))
          ) : (
            <Card className="p-5 items-center">
              <Ionicons name="checkmark-done-outline" size={28} color={colors.muted} />
              <Text className="text-muted text-[14px] mt-2 text-center">
                New orders appear here for you to accept.
              </Text>
            </Card>
          )}
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
