import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { CATEGORY_PALETTE, CategoryIcon } from '@/components/brand/CategoryIcons';
import { CATEGORIES, type Category } from '@/lib/mock';

/**
 * 4-across pillar grid (design.md §9). Marketplace carries the `New` ribbon
 * because Vendor Marketplace V1 is the Phase-1 differentiator (§11).
 */
export function CategoryGrid() {
  const router = useRouter();

  return (
    <View className="flex-row flex-wrap px-4">
      {CATEGORIES.map((cat) => (
        <CategoryTile
          key={cat.slug}
          category={cat}
          onPress={() =>
            cat.href
              ? router.push(cat.href as never)
              : router.push({ pathname: '/category/[slug]', params: { slug: cat.slug } })
          }
        />
      ))}
    </View>
  );
}

function CategoryTile({ category, onPress }: { category: Category; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={category.label}
      className="w-1/4 items-center mb-4 px-1"
    >
      <View
        className="w-full aspect-square rounded-xl items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: (CATEGORY_PALETTE[category.slug] ?? CATEGORY_PALETTE.packages!).tint }}
      >
        <CategoryIcon slug={category.slug} size={30} />
        {category.badge ? (
          <View className="absolute top-0 right-0 bg-savings px-1.5 py-0.5 rounded-bl-md">
            <Text className="text-white text-[9px] font-bold tracking-wide">{category.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-ink text-[13px] font-semibold mt-2 text-center" numberOfLines={1}>
        {category.label}
      </Text>
    </Pressable>
  );
}
