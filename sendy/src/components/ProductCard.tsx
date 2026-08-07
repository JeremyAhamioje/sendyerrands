import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { naira } from '@/lib/format';
import type { MenuItem, Product } from '@/lib/mock';
import { colors, shadow } from '@/lib/theme';

import { Badge } from './ui/atoms';
import { Thumb } from './ui/Thumb';

/**
 * Marketplace product card (design.md §9) — square image, price, add button.
 *
 * The add button is a sibling of the card pressable (see VendorCard) so the
 * markup never nests one button inside another.
 */
export function ProductCard({
  product,
  onPress,
  onAdd,
  width,
}: {
  product: Product;
  onPress?: () => void;
  onAdd?: () => void;
  /** Column width — also positions the floating add button over the image edge. */
  width: number;
}) {
  return (
    <View style={{ width }} className="mb-4">
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={product.name}>
        <View className="relative">
          <Thumb data={product.thumb} className="w-full aspect-square" rounded="rounded-lg" iconSize={36} />
          {product.biddable ? (
            <View className="absolute top-2 left-2">
              <Badge label="Biddable" tone="pink" />
            </View>
          ) : null}
        </View>

        <Text className="text-ink text-[15px] font-semibold mt-4" numberOfLines={2}>
          {product.name}
        </Text>
        <Text className="text-muted text-[13px] mt-0.5" numberOfLines={1}>
          {product.vendor}
        </Text>
        <Text className="text-ink text-[15px] font-bold mt-1">{naira(product.price)}</Text>
      </Pressable>

      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={`Add ${product.name}`}
        style={[shadow.card, { top: width - 18, right: 8 }]}
        className="absolute w-9 h-9 rounded-full bg-pink-600 items-center justify-center active:bg-pink-700"
      >
        <Ionicons name="add" size={20} color={colors.white} />
      </Pressable>
    </View>
  );
}

/** Menu row on the vendor detail screen — thumb left, add button overlapping it. */
export function MenuItemRow({
  item,
  onPress,
  onAdd,
  last = false,
}: {
  item: MenuItem;
  onPress?: () => void;
  onAdd?: () => void;
  last?: boolean;
}) {
  return (
    <View className={`relative ${last ? '' : 'border-b border-hairline'}`}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        className="flex-row px-4 py-4 active:bg-surface"
      >
        <View className="mr-3">
          <Thumb data={item.thumb} className="w-[84px] h-[84px]" rounded="rounded-md" iconSize={26} />
        </View>

        <View className="flex-1 pt-0.5">
          <Text className="text-ink text-[15px] font-semibold" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-muted text-[13px] mt-1 leading-[18px]" numberOfLines={2}>
            {item.description}
          </Text>
          <View className="flex-row items-center mt-2">
            <Text className="text-ink text-[15px] font-bold">{naira(item.price)}</Text>
            {item.badge ? (
              <View className="ml-2">
                <Badge label={item.badge} tone="pink" />
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* thumb is 84px at padding 16 → overlap its bottom-right corner */}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={`Add ${item.name}`}
        style={[shadow.card, { left: 76, top: 76 }]}
        className="absolute w-8 h-8 rounded-full bg-white border border-hairline items-center justify-center active:bg-pink-50"
      >
        <Ionicons name="add" size={18} color={colors.pink[600]} />
      </Pressable>
    </View>
  );
}
