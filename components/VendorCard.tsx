import { View, Text, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";

export type Vendor = {
  name: string;
  image: string; // remote URL for now; swap for expo-image later
  deliveryFrom: string; // "₦1,300"
  eta: string; // "39–49 min"
  rating: number; // 4.1
  ratingCount: number; // 678
  discount?: string; // "Up to ₦2,300 off"
  verified?: boolean;
};

// Sendy Errands vendor card — see design.md §9 ("Vendor card").
export function VendorCard({
  vendor,
  onPress,
}: {
  vendor: Vendor;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="w-full mb-4">
      {/* Cover + discount ribbon */}
      <View className="rounded-lg overflow-hidden bg-surface">
        <Image
          source={{ uri: vendor.image }}
          className="w-full h-44"
          resizeMode="cover"
        />
        {vendor.discount ? (
          <View className="absolute bottom-0 w-full bg-savings/95 py-2 flex-row items-center justify-center">
            <Ionicons name="pricetag" size={14} color="#FFFFFF" />
            <Text className="text-white text-[13px] font-semibold ml-1.5">
              {vendor.discount}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Title row */}
      <View className="flex-row items-center justify-between mt-2">
        <View className="flex-row items-center flex-1 pr-2">
          <Text className="text-ink text-[17px] font-semibold" numberOfLines={1}>
            {vendor.name}
          </Text>
          {vendor.verified ? (
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.success}
              style={{ marginLeft: 6 }}
            />
          ) : null}
        </View>
        <Ionicons name="heart-outline" size={22} color={colors.muted} />
      </View>

      {/* Meta row */}
      <View className="flex-row items-center mt-1">
        <Text className="text-muted text-[13px]">From {vendor.deliveryFrom}</Text>
        <Text className="text-hairline mx-2">|</Text>
        <Text className="text-muted text-[13px]">{vendor.eta}</Text>
        <View className="flex-row items-center ml-auto">
          <Ionicons name="star" size={13} color={colors.star} />
          <Text className="text-body text-[13px] font-medium ml-1">
            {vendor.rating.toFixed(1)} ({vendor.ratingCount})
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
