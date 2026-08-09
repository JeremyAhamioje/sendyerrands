import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, ListRow } from '@/components/ui/atoms';
import { Screen } from '@/components/ui/Screen';
import { koboToNaira } from '@/lib/api/mappers';
import { naira } from '@/lib/format';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/** Profile (design.md §10) — wallet, addresses, payment, settings, referrals. */
export default function Profile() {
  const router = useRouter();
  const { signOut, addresses, user } = useApp();
  const fullName = user ? user.firstName + ' ' + user.lastName : 'Your profile';
  const initials = user ? (user.firstName[0] + user.lastName[0]).toUpperCase() : '–';
  const walletBalance = koboToNaira(user?.walletBalanceKobo);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 py-3">
          <Text className="text-ink text-[24px] font-display">Profile</Text>
        </View>

        {/* identity */}
        <View className="flex-row items-center px-4 pb-5">
          <View className="w-16 h-16 rounded-full bg-pink-100 items-center justify-center">
            <Text className="text-pink-700 text-[20px] font-bold">{initials}</Text>
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-ink text-[20px] font-bold">{fullName}</Text>
            <Text className="text-muted text-[13px] mt-0.5">{user?.phone ?? ""}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" className="p-2">
            <Ionicons name="create-outline" size={21} color={colors.pink[600]} />
          </Pressable>
        </View>

        {/* wallet */}
        <View className="px-4">
          <Pressable onPress={() => router.push('/wallet')} accessibilityRole="button">
            <LinearGradient
              colors={[colors.pink[600], colors.pink[900]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 16, padding: 18 }}
            >
              <View className="flex-row items-center">
                <Text className="text-white/80 text-[13px] flex-1">Sendy Errands Wallet</Text>
                <Ionicons name="arrow-forward-circle" size={22} color="rgba(255,255,255,0.9)" />
              </View>
              <Text className="text-white text-[30px] font-bold mt-1.5">
                {naira(walletBalance)}
              </Text>
              <View className="flex-row items-center mt-3">
                <View className="bg-white/20 rounded-full px-3 py-1.5 flex-row items-center">
                  <Ionicons name="gift-outline" size={13} color={colors.white} />
                  <Text className="text-white text-[11px] font-semibold ml-1.5">
                    Sendy Errands Wallet
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* referral */}
        <View className="px-4 mt-4">
          <Card className="flex-row items-center p-4">
            <View className="w-10 h-10 rounded-full bg-pink-50 items-center justify-center mr-3">
              <Ionicons name="people-outline" size={19} color={colors.pink[600]} />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-[15px] font-semibold">Invite friends, earn ₦1,000</Text>
              <Text className="text-muted text-[13px] mt-0.5">Code {user?.referralCode ?? "—"}</Text>
            </View>
            <Pressable accessibilityRole="button" className="bg-pink-50 rounded-full px-4 py-2">
              <Text className="text-pink-700 text-[13px] font-semibold">Share</Text>
            </Pressable>
          </Card>
        </View>

        {/* account */}
        <Text className="text-muted text-[13px] font-semibold px-4 mt-7 mb-2">ACCOUNT</Text>
        <Card className="mx-4 overflow-hidden">
          <ListRow
            icon="location-outline"
            label="Saved addresses"
            value={`${addresses.length}`}
            onPress={() => router.push('/addresses')}
          />
          <ListRow icon="card-outline" label="Payment methods" value="2 cards" />
          <ListRow icon="receipt-outline" label="Order history" onPress={() => router.push('/(tabs)/orders')} />
          <ListRow
            icon="heart-outline"
            label="Favourites"
            last
            onPress={() => router.push('/favourites')}
          />
        </Card>

        <Text className="text-muted text-[13px] font-semibold px-4 mt-6 mb-2">PREFERENCES</Text>
        <Card className="mx-4 overflow-hidden">
          <ListRow icon="notifications-outline" label="Notifications" />
          <ListRow icon="language-outline" label="Language" value="English" />
          <ListRow icon="shield-checkmark-outline" label="Privacy & security" last />
        </Card>

        <Text className="text-muted text-[13px] font-semibold px-4 mt-6 mb-2">MORE</Text>
        <Card className="mx-4 overflow-hidden">
          <ListRow icon="bicycle-outline" label="Switch to rider app" onPress={() => router.push('/rider')} />
          <ListRow
            icon="storefront-outline"
            label="Become a vendor"
            onPress={() => router.push('/become-vendor')}
          />
          {/* Shown to everyone rather than gated on being a vendor: the app has
              no way to know until it tries, and the vendor gate explains itself
              to anyone who is not one. */}
          <ListRow
            icon="business-outline"
            label="Vendor dashboard"
            onPress={() => router.push('/vendor-app')}
          />
          <ListRow icon="headset-outline" label="Help & support" onPress={() => router.push('/help')} />
          <ListRow icon="log-out-outline" label="Log out" danger last onPress={async () => { await signOut(); router.replace('/'); }} />
        </Card>

        <Text className="text-muted text-[11px] text-center mt-7">Sendy Errands v1.0.0 (MVP)</Text>
      </ScrollView>
    </Screen>
  );
}
