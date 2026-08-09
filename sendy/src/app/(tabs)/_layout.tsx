import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/lib/theme';

/** Customer tab bar (design.md §9) — Home · Search · Orders · Support · Profile. */
export default function TabsLayout() {
  /**
   * The bar has to grow by the bottom inset rather than sit at a fixed height.
   *
   * Android is edge-to-edge from SDK 54 on, so the app draws underneath the
   * system navigation and `insets.bottom` is non-zero — and it differs per
   * device: roughly 48dp for three-button navigation, ~16dp for a gesture pill,
   * 0 on a device with hardware keys. Supplying an explicit `height` also opts
   * out of react-navigation's own inset handling, so the previous fixed 72
   * put the labels behind the navigation bar on most Android phones while
   * looking perfect on whichever one it was written against.
   */
  const insets = useSafeAreaInsets();

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
          // 60 clears the 23px icon + 11px label without clipping descenders;
          // the inset is the system's own space on top of that.
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
          backgroundColor: colors.white,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={23} color={color} />
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
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'headset' : 'headset-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
