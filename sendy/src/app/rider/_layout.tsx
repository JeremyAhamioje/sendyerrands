import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/atoms';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/** Rider tab bar — Home · Jobs · Earnings · Me. */
export default function RiderTabsLayout() {
  const router = useRouter();
  const { ready, signedIn, actor, signOut } = useApp();

  /**
   * The rider app needs a RIDER token. A customer arriving here (via "Switch to
   * rider app") would otherwise see every panel fail with a 403, so ask them to
   * sign in with their rider number instead.
   */
  if (ready && (!signedIn || actor !== 'rider')) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <EmptyState
            icon="bicycle-outline"
            title="Sign in as a rider"
            body={
              signedIn
                ? "You're signed in as a customer. Riders use a separate account — sign in with the number you registered to ride."
                : 'Sign in with the phone number you registered as a rider.'
            }
          >
            <Button
              title="Continue as a rider"
              fullWidth={false}
              onPress={async () => {
                if (signedIn) await signOut();
                // `role=rider` is what makes the API mint a rider token; without
                // it this button just looped back to the customer app.
                router.replace({ pathname: '/phone', params: { role: 'rider' } });
              }}
            />
            <View className="h-3" />
            <Text
              onPress={() => router.replace('/(tabs)/home')}
              className="text-pink-600 text-[15px] font-semibold"
            >
              Back to ordering
            </Text>
          </EmptyState>
        </View>
      </Screen>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pink[600],
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: 72,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: colors.white,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
