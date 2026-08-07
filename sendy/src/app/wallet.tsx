import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';

import { Badge, Card, Divider } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useWallet } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import { colors } from '@/lib/theme';

const TRANSACTIONS = [
  { id: 't1', label: 'Mama Nkechi Kitchen', sub: 'Today, 2:31 PM', amount: -15700, icon: 'fast-food-outline' as const },
  { id: 't2', label: 'Wallet top-up', sub: 'Today, 9:12 AM', amount: 20000, icon: 'add-circle-outline' as const },
  { id: 't3', label: 'Send a package · Ikoyi → VI', sub: 'Today, 11:04 AM', amount: -1300, icon: 'cube-outline' as const },
  { id: 't4', label: 'Referral bonus · Tunde A.', sub: 'Yesterday', amount: 1000, icon: 'gift-outline' as const },
  { id: 't5', label: 'GadgetHub Lekki', sub: 'Yesterday, 5:12 PM', amount: -19500, icon: 'hardware-chip-outline' as const },
  { id: 't6', label: 'Refund · SND-8655', sub: '1 Aug', amount: 6400, icon: 'return-down-back-outline' as const },
];

/** Sendy Wallet (design.md §10, under Profile). */
export default function Wallet() {
  const { data } = useWallet();
  const balance = data?.balance ?? 0;
  return (
    <Screen className="bg-surface">
      <View className="bg-white">
        <ScreenHeader title="Sendy Wallet" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* balance */}
        <LinearGradient
          colors={[colors.pink[600], colors.pink[900]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 16, padding: 20 }}
        >
          <Text className="text-white/80 text-[13px]">Available balance</Text>
          <Text className="text-white text-[34px] font-bold mt-1">
            {naira(balance)}
          </Text>
          <View className="flex-row items-center mt-2">
            <View className="bg-white/20 rounded-full px-3 py-1.5 flex-row items-center">
              <Ionicons name="gift-outline" size={13} color={colors.white} />
              <Text className="text-white text-[11px] font-semibold ml-1.5">
                Instant refunds
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* actions */}
        <View className="flex-row mt-4">
          <View className="flex-1 mr-3">
            <Button title="Fund wallet" icon="add" />
          </View>
          <View className="flex-1">
            <Button title="Withdraw" variant="secondary" icon="arrow-up" />
          </View>
        </View>

        {/* auto top-up */}
        <Card className="flex-row items-center p-4 mt-4">
          <View className="w-9 h-9 rounded-full bg-pink-50 items-center justify-center mr-3">
            <Ionicons name="repeat-outline" size={17} color={colors.pink[600]} />
          </View>
          <View className="flex-1">
            <Text className="text-ink text-[15px] font-semibold">Auto top-up</Text>
            <Text className="text-muted text-[13px] mt-0.5">
              Add {naira(10000)} when balance drops below {naira(2000)}
            </Text>
          </View>
          <Badge label="Off" tone="muted" />
        </Card>

        {/* transactions */}
        <Text className="text-muted text-[13px] font-semibold mt-6 mb-2.5">TRANSACTIONS</Text>
        <Card>
          {TRANSACTIONS.map((tx, i) => (
            <View key={tx.id}>
              {i > 0 ? <Divider className="mx-4" /> : null}
              <View className="flex-row items-center px-4 py-3.5">
                <View
                  className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
                    tx.amount > 0 ? 'bg-success/10' : 'bg-surface'
                  }`}
                >
                  <Ionicons
                    name={tx.icon}
                    size={17}
                    color={tx.amount > 0 ? colors.success : colors.body}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-ink text-[15px] font-medium" numberOfLines={1}>
                    {tx.label}
                  </Text>
                  <Text className="text-muted text-[13px] mt-0.5">{tx.sub}</Text>
                </View>
                <Text
                  className={`text-[15px] font-bold ${tx.amount > 0 ? 'text-success' : 'text-ink'}`}
                >
                  {tx.amount > 0 ? '+' : '−'} {naira(Math.abs(tx.amount))}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
