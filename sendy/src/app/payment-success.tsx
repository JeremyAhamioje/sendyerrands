import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Card, Divider } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useOrder, usePayForOrder, useSettleReturnedPayment } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import { colors } from '@/lib/theme';

/**
 * Payment confirmation.
 *
 * This screen used to be entirely static: a green tick, "Mama Nkechi Kitchen is
 * preparing your food", reference SND-8841 and a Track button pointing at
 * ord-8841 — shown to every customer, for every order, including ones paid by
 * card where no payment had been attempted at all. Checkout asked the API for a
 * Paystack URL and then handed it here, where nothing opened it.
 *
 * So it now does the three things it was pretending to do: send the customer to
 * Paystack when there is something to pay, ask the server what happened, and
 * only claim success when the server says so.
 */
export default function PaymentSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; reference?: string; url?: string }>();

  const pay = usePayForOrder();
  // Set when Paystack sent the customer back here rather than into the app.
  const returned = useSettleReturnedPayment();

  const orderId = params.orderId ?? returned?.orderId;
  const { data } = useOrder(orderId);

  /**
   * Hand off to Paystack once, on arrival.
   *
   * Guarded by a ref rather than a dependency list: on web this navigates the
   * tab away, and a second run would start a second payment for one order.
   */
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !params.url || !params.reference || !params.orderId) return;
    started.current = true;
    pay.mutate({
      orderId: params.orderId,
      reference: params.reference,
      authorizationUrl: params.url,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.url, params.reference, params.orderId]);

  const paying = Boolean(params.url) && (pay.isPending || pay.data?.status === 'REDIRECTING');
  const failed =
    returned?.status === 'FAILED' ||
    (pay.data && 'status' in pay.data && pay.data.status === 'FAILED') ||
    pay.isError;

  if (paying) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color={colors.pink[600]} />
          <Text className="text-ink text-[17px] font-bold mt-5">Opening secure payment…</Text>
          <Text className="text-muted text-[14px] text-center mt-2 leading-[20px]">
            You&apos;ll pay with Paystack and come straight back here.
          </Text>
        </View>
      </Screen>
    );
  }

  if (failed) {
    return (
      <Screen>
        <View className="flex-1 px-6 items-center justify-center">
          <View className="w-20 h-20 rounded-full bg-error/10 items-center justify-center mb-6">
            <Ionicons name="close" size={34} color={colors.error} />
          </View>
          <Text className="text-ink text-[24px] font-display text-center">Payment not completed</Text>
          <Text className="text-body text-[15px] text-center mt-2.5 leading-[22px]">
            Nothing was charged. Your order is saved and waiting — you can pay for it from your
            orders.
          </Text>
        </View>
        <View className="px-4 pb-10">
          <Button title="Go to my orders" onPress={() => router.replace('/(tabs)/orders')} />
          <View className="h-3" />
          <Button title="Back to home" variant="text" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      </Screen>
    );
  }

  const order = data?.order;
  // Only package orders carry a drop-off on the order itself. Rather than show
  // the device's currently-selected address and call it "delivering to" — which
  // is a guess, and wrong as soon as it changes — the row is omitted when the
  // API has nothing to say.
  const dropoff = data?.raw?.packageDetail?.dropoffAddress;

  return (
    <Screen>
      <View className="flex-1 px-6 items-center justify-center">
        <View className="w-24 h-24 rounded-full bg-success/10 items-center justify-center mb-6">
          <View className="w-16 h-16 rounded-full bg-success items-center justify-center">
            <Ionicons name="checkmark" size={36} color={colors.white} />
          </View>
        </View>

        <Text className="text-ink text-[28px] font-display text-center">Order placed</Text>
        <Text className="text-body text-[15px] text-center mt-2.5 leading-[22px]">
          {order?.vendor
            ? `${order.vendor} is getting your order ready. We'll assign a rider shortly.`
            : "We're getting your order ready and will assign a rider shortly."}
        </Text>

        <Card className="w-full p-4 mt-8">
          <Row label="Order reference" value={order?.reference ?? '—'} />
          <Divider className="my-3" />
          <Row label="Amount paid" value={data ? naira(data.totals.total) : '—'} bold />
          {dropoff ? (
            <>
              <Divider className="my-3" />
              <Row label="Delivering to" value={dropoff} />
            </>
          ) : null}
        </Card>
      </View>

      <View className="px-4 pb-10">
        <Button
          title="Track your order"
          icon="navigate-outline"
          disabled={!orderId}
          onPress={() => router.replace({ pathname: '/track/[id]', params: { id: orderId! } })}
        />
        <View className="h-3" />
        <Button title="Back to home" variant="text" onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </Screen>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center">
      <Text className="text-muted text-[13px] flex-1">{label}</Text>
      <Text
        className={`text-ink text-[15px] flex-1 text-right ${bold ? 'font-bold' : 'font-medium'}`}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}
