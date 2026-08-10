import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, Divider } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { ApiError } from '@/lib/api/client';
import { useCheckout, useCreateOrder } from '@/lib/api/hooks';
import { koboToNaira } from '@/lib/api/mappers';
import { naira } from '@/lib/format';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/** Checkout (design.md §10) — address, delivery option, payment method. */
export default function Checkout() {
  const router = useRouter();
  const { activeAddress, total, deliveryFee, cart, vendorId, user, clearCart } = useApp();
  const [delivery, setDelivery] = useState('express');
  const [payment, setPayment] = useState('wallet');
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCreateOrder();
  const checkout = useCheckout();
  const walletBalance = koboToNaira(user?.walletBalanceKobo);
  const busy = createOrder.isPending || checkout.isPending;

  /**
   * Two calls, deliberately: the server prices the order first, then charges
   * its own total. The client never submits an amount.
   */
  const placeOrder = async () => {
    setError(null);
    if (!activeAddress || !vendorId) {
      setError('Choose a delivery address first.');
      return;
    }
    try {
      const order = await createOrder.mutateAsync({
        vendorId,
        addressId: activeAddress.id,
        items: cart.map((l) => ({ productId: l.id, quantity: l.qty, note: l.note })),
      });

      const result = await checkout.mutateAsync({
        orderId: order.id,
        method: payment === 'wallet' ? 'WALLET' : 'PAYSTACK',
      });

      if (result.authorizationUrl) {
        // Card/transfer: hand off to Paystack, then verify on return.
        router.push({ pathname: '/payment-success', params: { reference: result.reference, url: result.authorizationUrl } });
        return;
      }

      clearCart();
      router.replace({ pathname: '/payment-success', params: { orderId: order.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place your order. Please try again.');
    }
  };

  return (
    <Screen className="bg-surface">
      <View className="bg-white">
        <ScreenHeader title="Checkout" />
      </View>

      {/* Bottom padding clears the sticky CTA *and* the two banners that can
          stack above it — otherwise the error message is hidden behind it. */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 230 }} showsVerticalScrollIndicator={false}>
        {/* address */}
        <Text className="text-muted text-[13px] font-semibold mb-2">DELIVERY ADDRESS</Text>
        <Card className="flex-row items-start p-4 mb-5">
          <View className="w-9 h-9 rounded-full bg-pink-50 items-center justify-center mr-3">
            <Ionicons name="location-outline" size={17} color={colors.pink[600]} />
          </View>
          <View className="flex-1">
            {activeAddress ? (
              <>
                <Text className="text-ink text-[15px] font-semibold">{activeAddress.label}</Text>
                <Text className="text-body text-[13px] mt-1 leading-[18px]">
                  {[activeAddress.line1, activeAddress.line2].filter(Boolean).join(', ')}
                </Text>
                <Text className="text-muted text-[13px] mt-1">
                  {activeAddress.contact} · {activeAddress.phone}
                </Text>
              </>
            ) : (
              <>
                <Text className="text-ink text-[15px] font-semibold">No address yet</Text>
                <Text className="text-muted text-[13px] mt-1 leading-[18px]">
                  Add where you want this delivered.
                </Text>
              </>
            )}
          </View>
          <Pressable
            onPress={() => router.push('/addresses')}
            accessibilityRole="button"
            className="px-1 py-1"
          >
            <Text className="text-pink-600 text-[13px] font-semibold">
              {activeAddress ? 'Change' : 'Add'}
            </Text>
          </Pressable>
        </Card>

        {/* delivery option */}
        <Text className="text-muted text-[13px] font-semibold mb-2">DELIVERY OPTION</Text>
        <Card className="mb-5">
          <OptionRow
            icon="bicycle-outline"
            title="Sendy Errands Express"
            subtitle="Fastest · 25–35 min"
            value={naira(deliveryFee)}
            selected={delivery === 'express'}
            onPress={() => setDelivery('express')}
          />
          <Divider className="mx-4" />
          <OptionRow
            icon="calendar-outline"
            title="Schedule for later"
            subtitle="Choose a delivery time"
            selected={delivery === 'scheduled'}
            onPress={() => setDelivery('scheduled')}
            last
          />
        </Card>

        {/* payment */}
        <Text className="text-muted text-[13px] font-semibold mb-2">PAYMENT METHOD</Text>
        <Card>
          <OptionRow
            icon="wallet-outline"
            title="Sendy Errands Wallet"
            subtitle={`Balance ${naira(walletBalance)}`}
            selected={payment === 'wallet'}
            onPress={() => setPayment('wallet')}
          />
          <Divider className="mx-4" />
          {/* One row, not "Debit card •••• 4291" and "Bank transfer" as two.
              There is no saved card — that number was decoration — and both
              rows opened the same Paystack page, which offers card, transfer
              and USSD itself. Naming the destination is more honest than
              implying we hold payment details we do not have. */}
          <OptionRow
            icon="card-outline"
            title="Card or bank transfer"
            subtitle="Pay securely with Paystack"
            selected={payment === 'card'}
            onPress={() => setPayment('card')}
            last
          />
        </Card>

        {payment === 'wallet' && walletBalance < total ? (
          <View className="flex-row items-start bg-savings/10 rounded-md p-3 mt-4">
            <Ionicons name="alert-circle" size={17} color={colors.savings} />
            <Text className="text-body text-[13px] ml-2 flex-1 leading-[18px]">
              Your wallet has {naira(walletBalance)} — {naira(total - walletBalance)} short. Top up,
              or pay by card instead.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View className="flex-row items-start bg-error/10 rounded-md p-3 mt-4">
            <Ionicons name="close-circle" size={17} color={colors.error} />
            <Text className="text-error text-[13px] ml-2 flex-1 leading-[18px]">{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <StickyBar>
        <Button
          title={`Place order · ${naira(total)}`}
          icon="shield-checkmark"
          loading={busy}
          disabled={!cart.length || !activeAddress}
          onPress={placeOrder}
        />
      </StickyBar>
    </Screen>
  );
}

function OptionRow({
  icon,
  title,
  subtitle,
  value,
  selected,
  onPress,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value?: string;
  selected: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`flex-row items-center p-4 active:bg-surface ${last ? '' : ''}`}
    >
      <View className="w-9 h-9 rounded-full bg-pink-50 items-center justify-center mr-3">
        <Ionicons name={icon} size={17} color={colors.pink[600]} />
      </View>
      <View className="flex-1">
        <Text className="text-ink text-[15px] font-semibold">{title}</Text>
        <Text className="text-muted text-[13px] mt-0.5">{subtitle}</Text>
      </View>
      {value ? <Text className="text-ink text-[15px] font-bold mr-3">{value}</Text> : null}
      {selected ? (
        <View className="w-6 h-6 rounded-full bg-pink-600 items-center justify-center">
          <Ionicons name="checkmark" size={15} color={colors.white} />
        </View>
      ) : (
        <View className="w-6 h-6 rounded-full border-2 border-hairline" />
      )}
    </Pressable>
  );
}
