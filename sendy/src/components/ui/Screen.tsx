import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow } from '@/lib/theme';

import { IconButton } from './Button';

/**
 * Screen chrome: back chevron, centred title, optional right slot.
 * Sits inside the safe area so it clears the notch.
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
  border = false,
  transparent = false,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  border?: boolean;
  transparent?: boolean;
}) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home')));

  return (
    <View
      className={`flex-row items-center px-4 py-2 ${transparent ? '' : 'bg-white'} ${
        border ? 'border-b border-hairline' : ''
      }`}
    >
      <IconButton icon="arrow-back" onPress={back} accessibilityLabel="Go back" tone={transparent ? 'white' : 'surface'} />
      <View className="flex-1 items-center px-2">
        {title ? (
          <Text className="text-ink text-[17px] font-bold" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text className="text-muted text-[13px]" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="min-w-[40px] items-end">{right}</View>
    </View>
  );
}

/** Full-bleed white screen wrapper that respects the notch. */
export function Screen({
  children,
  className = '',
  edges = ['top'],
}: {
  children: React.ReactNode;
  className?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  return (
    <SafeAreaView edges={edges} className={`flex-1 bg-white ${className}`}>
      {children}
    </SafeAreaView>
  );
}

/**
 * Sticky CTA docked above the home indicator, with shadow-float.
 * `inTabs` adds clearance for the tab bar (design.md §7).
 */
export function StickyBar({
  children,
  inTabs = false,
}: {
  children: React.ReactNode;
  inTabs?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[shadow.float, { paddingBottom: Math.max(insets.bottom, 12) + (inTabs ? 60 : 0) }]}
      className="absolute left-0 right-0 bottom-0 bg-white px-4 pt-3 border-t border-hairline"
    >
      {children}
    </View>
  );
}

/** Segmented control used on Orders (Active / History) and Earnings. */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row bg-surface rounded-full p-1 mx-4">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`flex-1 h-9 rounded-full items-center justify-center ${active ? 'bg-white' : ''}`}
            style={active ? shadow.card : undefined}
          >
            <Text className={`text-[13px] font-semibold ${active ? 'text-ink' : 'text-muted'}`}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Location selector in the Home app bar (design.md §9). */
export function LocationSelector({
  address,
  onPress,
}: {
  address: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center flex-1">
      <Ionicons name="location" size={18} color={colors.pink[600]} />
      <View className="ml-2 flex-1">
        <Text className="text-muted text-[11px] font-semibold tracking-wide">DELIVER TO</Text>
        <View className="flex-row items-center">
          <Text className="text-ink text-[15px] font-semibold max-w-[80%]" numberOfLines={1}>
            {address}
          </Text>
          <Ionicons name="chevron-down" size={15} color={colors.ink} style={{ marginLeft: 4 }} />
        </View>
      </View>
    </Pressable>
  );
}
