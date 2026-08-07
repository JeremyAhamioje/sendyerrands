import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { VendorCard, Vendor } from "../../components/VendorCard";

const CATEGORIES = ["Errands", "Delivery", "Marketplace", "Shops", "Pharmacies", "Bills"];

const SAMPLE: Vendor[] = [
  {
    name: "Mama T's Kitchen — Isawo",
    image: "https://images.unsplash.com/photo-1604909052743-94e838986d24?w=800",
    deliveryFrom: "₦1,300",
    eta: "39–49 min",
    rating: 4.6,
    ratingCount: 678,
    discount: "Up to ₦2,300 off",
    verified: true,
  },
  {
    name: "FreshMart Local Market",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",
    deliveryFrom: "₦900",
    eta: "25–35 min",
    rating: 4.3,
    ratingCount: 214,
    verified: true,
  },
];

export default function Home() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header: location + filter */}
        <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
          <Pressable className="flex-row items-center flex-1">
            <Ionicons name="location" size={18} color={colors.pink[600]} />
            <Text className="text-ink text-[15px] font-semibold ml-1" numberOfLines={1}>
              Ajegunle Road, Lagos
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.body} />
          </Pressable>
          <Pressable className="flex-row items-center border border-pink-600 rounded-full px-3 py-1.5">
            <Text className="text-pink-600 text-[13px] font-semibold mr-1">Filter</Text>
            <Ionicons name="options-outline" size={16} color={colors.pink[600]} />
          </Pressable>
        </View>

        {/* Promo banner */}
        <View className="mx-4 rounded-lg bg-pink-600 px-4 py-5 mb-4">
          <Text className="text-white text-[18px] font-bold">Pay less, get more</Text>
          <Text className="text-pink-100 text-[13px] mt-1">
            Free delivery on your first Marketplace order.
          </Text>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          className="mb-5"
        >
          {CATEGORIES.map((c) => (
            <View key={c} className="bg-pink-100 rounded-full px-4 py-2">
              <Text className="text-pink-700 text-[13px] font-semibold">{c}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Section header */}
        <View className="flex-row items-center justify-between px-4 mb-3">
          <Text className="text-ink text-[20px] font-bold">Handpicked for you</Text>
          <Text className="text-pink-600 text-[13px] font-semibold">View all</Text>
        </View>

        {/* Vendor list */}
        <View className="px-4">
          {SAMPLE.map((v) => (
            <VendorCard key={v.name} vendor={v} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
