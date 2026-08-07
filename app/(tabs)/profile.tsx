import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Stub — build this out with the design.md per-screen template.
export default function Profile() {
  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center">
      <Text className="text-ink text-[20px] font-bold">Profile</Text>
      <Text className="text-muted text-[13px] mt-1">Coming soon</Text>
    </SafeAreaView>
  );
}
