import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, Divider, EmptyState, Verified } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { Thumb } from '@/components/ui/Thumb';
import { naira } from '@/lib/format';
import { useVendor } from '@/lib/api/hooks';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/** Cart / basket (design.md §10). */
export default function Cart() {
  const router = useRouter();
  const { cart, setQty, clearCart, vendorId, subtotal, deliveryFee, serviceFee, discount, total } =
    useApp();
  const { data: vendorData } = useVendor(vendorId ?? undefined);
  const vendor = vendorData?.vendor;

  if (!cart.length) {
    return (
      <Screen>
        <ScreenHeader title="Your cart" />
        <EmptyState
          icon="basket-outline"
          title="Your cart is empty"
          body="Add something from a vendor and it will show up here."
        >
          <Button title="Browse vendors" fullWidth={false} onPress={() => router.replace('/(tabs)/home')} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen className="bg-surface">
      <View className="bg-white">
        <ScreenHeader
          title="Your cart"
          right={
            <Pressable onPress={clearCart} accessibilityRole="button" className="px-2 py-1">
              <Text className="text-pink-600 text-[15px] font-semibold">Clear</Text>
            </Pressable>
          }
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* vendor */}
        <Card className="flex-row items-center p-3.5 mb-3">
          <View className="w-10 h-10 rounded-full bg-pink-50 items-center justify-center mr-3">
            <Ionicons name="storefront-outline" size={19} color={colors.pink[600]} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-ink text-[15px] font-semibold" numberOfLines={1}>
                {vendor?.name ?? 'Your order'}
              </Text>
              <View className="ml-1.5">
                <Verified size={14} />
              </View>
            </View>
            <Text className="text-muted text-[13px] mt-0.5">
              Delivery in {vendor?.etaMin ?? 25}–{vendor?.etaMax ?? 35} min
            </Text>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor?.id ?? '' } })}
            accessibilityRole="button"
            className="flex-row items-center"
          >
            <Text className="text-pink-600 text-[13px] font-semibold mr-1">Add items</Text>
            <Ionicons name="add" size={15} color={colors.pink[600]} />
          </Pressable>
        </Card>

        {/* lines */}
        <Card className="mb-3">
          {cart.map((line, i) => (
            <View key={line.id}>
              {i > 0 ? <Divider className="mx-3.5" /> : null}
              <View className="flex-row items-center p-3.5">
                <Thumb data={line.thumb} className="w-14 h-14" iconSize={20} />
                <View className="flex-1 mx-3">
                  <Text className="text-ink text-[15px] font-semibold" numberOfLines={2}>
                    {line.name}
                  </Text>
                  {line.note ? (
                    <Text className="text-muted text-[13px] mt-0.5" numberOfLines={1}>
                      {line.note}
                    </Text>
                  ) : null}
                  <Text className="text-ink text-[15px] font-bold mt-1">{naira(line.price)}</Text>
                </View>

                {/* qty stepper */}
                <View className="flex-row items-center">
                  <Pressable
                    onPress={() => setQty(line.id, line.qty - 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease ${line.name}`}
                    className="w-8 h-8 rounded-full border border-hairline items-center justify-center active:bg-surface"
                  >
                    <Ionicons name="remove" size={16} color={colors.ink} />
                  </Pressable>
                  <Text className="text-ink text-[15px] font-semibold w-8 text-center">{line.qty}</Text>
                  <Pressable
                    onPress={() => setQty(line.id, line.qty + 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${line.name}`}
                    className="w-8 h-8 rounded-full bg-pink-600 items-center justify-center active:bg-pink-700"
                  >
                    <Ionicons name="add" size={16} color={colors.white} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </Card>

        {/* voucher */}
        <Pressable accessibilityRole="button">
          <Card className="flex-row items-center p-3.5 mb-3">
            <View className="w-9 h-9 rounded-full bg-pink-50 items-center justify-center mr-3">
              <Ionicons name="pricetag-outline" size={17} color={colors.pink[600]} />
            </View>
            <Text className="flex-1 text-ink text-[15px]">Apply a voucher or Sendy Errands credit</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Card>
        </Pressable>

        {/* summary */}
        <Text className="text-muted text-[13px] font-semibold mb-2 mt-1">PAYMENT SUMMARY</Text>
        <Card className="p-4">
          <SummaryRow label="Subtotal" value={naira(subtotal)} />
          <SummaryRow label="Delivery fee" value={naira(deliveryFee)} />
          <SummaryRow label="Service fee" value={naira(serviceFee)} />
          <SummaryRow label="Discount" value={`− ${naira(discount)}`} tone="success" />
          <Divider className="my-3" />
          <View className="flex-row items-center">
            <Text className="text-ink text-[15px] font-bold flex-1">Total</Text>
            <Text className="text-ink text-[20px] font-bold">{naira(total)}</Text>
          </View>
        </Card>
      </ScrollView>

      <StickyBar>
        <Button
          title="Proceed to checkout"
          trailing={naira(total)}
          onPress={() => router.push('/checkout')}
        />
      </StickyBar>
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success';
}) {
  return (
    <View className="flex-row items-center mb-2.5">
      <Text className="text-body text-[15px] flex-1">{label}</Text>
      <Text className={`text-[15px] font-medium ${tone === 'success' ? 'text-success' : 'text-ink'}`}>
        {value}
      </Text>
    </View>
  );
}
