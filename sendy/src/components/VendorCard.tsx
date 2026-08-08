import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useFavouriteIds, useToggleFavourite } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import type { Vendor } from '@/lib/mock';
import { colors } from '@/lib/theme';

import { Rating, Verified } from './ui/atoms';
import { Thumb } from './ui/Thumb';

/**
 * Vendor card (design.md §9) — cover with discount ribbon, name + verified,
 * then the glanceable meta row: fee · ETA · rating. Closed vendors dim the cover.
 *
 * The favourite toggle is a SIBLING of the card pressable, not a child: nesting
 * one button inside another is invalid HTML and breaks hydration on web.
 */
export function VendorCard({
  vendor,
  onPress,
  width,
}: {
  vendor: Vendor;
  onPress?: () => void;
  /** Set for the horizontal carousel; omit for full-width list rows. */
  width?: number;
}) {
  // Saved state lives on the server, so it survives a remount, a reinstall and
  // a second device — it used to be local component state that reset on scroll.
  const saved = useFavouriteIds().has(vendor.id);
  const toggle = useToggleFavourite();

  return (
    <View style={width ? { width } : undefined} className={width ? 'mr-3' : 'w-full mb-5'}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={vendor.name}>
        <View className="rounded-lg overflow-hidden bg-surface relative">
          <Thumb data={vendor.cover} className="w-full h-44" rounded="rounded-lg" iconSize={40} />

          {!vendor.open ? (
            <View className="absolute inset-0 bg-ink/45 items-center justify-center">
              <View className="bg-white px-3 py-1.5 rounded-full">
                <Text className="text-ink text-[13px] font-semibold">Opens {vendor.closesAt}</Text>
              </View>
            </View>
          ) : null}

          {vendor.discount && vendor.open ? (
            <View className="absolute bottom-0 left-0 right-0 bg-savings flex-row items-center px-3 py-2">
              <Ionicons name="pricetag" size={13} color={colors.white} />
              <Text className="text-white text-[13px] font-semibold ml-1.5">{vendor.discount}</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center mt-2.5 pr-12">
          <Text className="text-ink text-[17px] font-bold flex-shrink" numberOfLines={1}>
            {vendor.name}
          </Text>
          {vendor.verified ? (
            <View className="ml-1.5">
              <Verified />
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center mt-1">
          <Text className="text-muted text-[13px]">From {naira(vendor.deliveryFee)}</Text>
          <View className="w-1 h-1 rounded-full bg-hairline mx-2" />
          <Text className="text-muted text-[13px]">
            {vendor.etaMin}–{vendor.etaMax} min
          </Text>
          <View className="flex-1" />
          <Rating value={vendor.rating} count={vendor.ratingCount} />
        </View>
      </Pressable>

      <Pressable
        onPress={() => toggle.mutate({ vendorId: vendor.id, saved })}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from favourites' : 'Save vendor'}
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 items-center justify-center"
      >
        <Ionicons
          name={saved ? 'heart' : 'heart-outline'}
          size={18}
          color={saved ? colors.pink[600] : colors.ink}
        />
      </Pressable>
    </View>
  );
}
