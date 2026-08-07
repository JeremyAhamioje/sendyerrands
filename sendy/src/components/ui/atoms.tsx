import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, type ViewProps } from 'react-native';

import { colors, shadow } from '@/lib/theme';

/** Pill chip / filter — selected turns pink-100 + pink-700 (design.md §9). */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  className = '',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center h-9 px-4 rounded-full mr-2 ${
        selected ? 'bg-pink-100 border border-pink-200' : 'bg-surface border border-transparent'
      } ${className}`}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? colors.pink[700] : colors.body}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text className={`text-[13px] font-medium ${selected ? 'text-pink-700' : 'text-body'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

type BadgeTone = 'pink' | 'savings' | 'success' | 'muted' | 'info' | 'error';

export function Badge({
  label,
  tone = 'pink',
  icon,
  className = '',
}: {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
}) {
  const map: Record<BadgeTone, { bg: string; text: string; icon: string }> = {
    pink: { bg: 'bg-pink-100', text: 'text-pink-700', icon: colors.pink[700] },
    savings: { bg: 'bg-savings', text: 'text-white', icon: colors.white },
    success: { bg: 'bg-success/10', text: 'text-success', icon: colors.success },
    muted: { bg: 'bg-surface', text: 'text-body', icon: colors.body },
    info: { bg: 'bg-info/10', text: 'text-info', icon: colors.info },
    error: { bg: 'bg-error/10', text: 'text-error', icon: colors.error },
  };
  const t = map[tone];
  return (
    <View className={`flex-row items-center px-2.5 py-1 rounded-full ${t.bg} ${className}`}>
      {icon ? <Ionicons name={icon} size={11} color={t.icon} style={{ marginRight: 4 }} /> : null}
      <Text className={`text-[11px] font-semibold ${t.text}`}>{label}</Text>
    </View>
  );
}

/** Green verified tick used on vendors, bids and riders. */
export function Verified({ size = 16 }: { size?: number }) {
  return <Ionicons name="checkmark-circle" size={size} color={colors.success} />;
}

export function Rating({
  value,
  count,
  size = 13,
}: {
  value: number;
  count?: string | number;
  size?: number;
}) {
  return (
    <View className="flex-row items-center">
      <Ionicons name="star" size={size} color={colors.star} />
      <Text className="text-body text-[13px] font-medium ml-1">
        {value.toFixed(1)}
        {count !== undefined ? ` · ${count}` : ''}
      </Text>
    </View>
  );
}

/** H2 section title with an optional `View all` link (design.md §9). */
export function SectionHeader({
  title,
  actionLabel = 'View all',
  onAction,
  className = '',
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <View className={`flex-row items-center justify-between px-4 mb-3 ${className}`}>
      <Text className="text-ink text-[20px] font-bold">{title}</Text>
      {onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" className="flex-row items-center">
          <Text className="text-pink-600 text-[13px] font-semibold mr-0.5">{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.pink[600]} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** White card with hairline border + soft elevation. */
export function Card({ className = '', style, children, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      style={[shadow.card, style]}
      className={`bg-white rounded-lg border border-hairline ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}

/** 8px `surface` band between major sections (design.md §7). */
export function SectionGap({ height = 8 }: { height?: number }) {
  return <View style={{ height }} className="bg-surface w-full" />;
}

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px bg-hairline ${className}`} />;
}

/** Settings / profile row: icon tile, label, optional value, chevron. */
export function ListRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center px-4 py-3.5 active:bg-surface ${
        last ? '' : 'border-b border-hairline'
      }`}
    >
      <View className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${danger ? 'bg-error/10' : 'bg-pink-50'}`}>
        <Ionicons name={icon} size={17} color={danger ? colors.error : colors.pink[600]} />
      </View>
      <Text className={`flex-1 text-[15px] ${danger ? 'text-error' : 'text-ink'}`}>{label}</Text>
      {value ? <Text className="text-muted text-[13px] mr-2">{value}</Text> : null}
      <Ionicons name="chevron-forward" size={17} color={colors.muted} />
    </Pressable>
  );
}

/** Empty state: illustration slot + one-line reason + action (design.md §9). */
export function EmptyState({
  icon = 'cube-outline',
  title,
  body,
  children,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <View className="items-center px-8 py-14">
      <View className="w-24 h-24 rounded-full bg-pink-50 items-center justify-center mb-5">
        <Ionicons name={icon} size={40} color={colors.pink[400]} />
      </View>
      <Text className="text-ink text-[20px] font-bold text-center">{title}</Text>
      <Text className="text-muted text-[15px] text-center mt-2 mb-6 leading-[22px]">{body}</Text>
      {children}
    </View>
  );
}

/** Grey skeleton block — design.md §9 says never spin for content. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <View className={`bg-surface rounded-md ${className}`} />;
}
