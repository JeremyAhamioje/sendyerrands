import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/**
 * Vendor tab bar — Today · Listings · Orders · Me.
 *
 * Lives at /vendor-app rather than /vendor because /vendor/[id] is already the
 * customer-facing store page. Two route groups cannot share that prefix without
 * the dynamic segment swallowing these tabs.
 */
export default function VendorTabsLayout() {
  const router = useRouter();
  const { ready, signedIn, actor, signOut } = useApp();

  // Same gate as the rider app: a customer token here would 403 on every panel.
  if (ready && (!signedIn || actor !== 'vendor')) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <EmptyState
            icon="storefront-outline"
            title="Sign in as a vendor"
            body={
              signedIn
                ? 'You’re signed in as a customer. Vendors use the number Sendy approved for your business.'
                : 'Sign in with the number Sendy approved for your business.'
            }
          >
            <Button
              title="Continue as a vendor"
              fullWidth={false}
              onPress={async () => {
                if (signedIn) await signOut();
                router.replace({ pathname: '/phone', params: { role: 'vendor' } });
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
        tabBarStyle: { borderTopColor: colors.hairline, height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'pricetags' : 'pricetags-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={23} color={color} />
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
