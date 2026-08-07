import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Card, Divider } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { naira } from '@/lib/format';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/** Payment success (design.md §10) — confirmation, then straight into tracking. */
export default function PaymentSuccess() {
  const router = useRouter();
  const { total, activeAddress } = useApp();

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
          Mama Nkechi Kitchen is preparing your food. We&apos;ll assign a rider in a moment.
        </Text>

        <Card className="w-full p-4 mt-8">
          <Row label="Order reference" value="SND-8841" />
          <Divider className="my-3" />
          <Row label="Amount paid" value={naira(total)} bold />
          <Divider className="my-3" />
          <Row label="Delivering to" value={activeAddress?.label ?? 'Your address'} />
          <Divider className="my-3" />
          <Row label="Estimated arrival" value="25–35 min" />
        </Card>
      </View>

      <View className="px-4 pb-10">
        <Button
          title="Track your order"
          icon="navigate-outline"
          onPress={() => router.replace({ pathname: '/track/[id]', params: { id: 'ord-8841' } })}
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
      <Text className={`text-ink text-[15px] ${bold ? 'font-bold' : 'font-medium'}`}>{value}</Text>
    </View>
  );
}
