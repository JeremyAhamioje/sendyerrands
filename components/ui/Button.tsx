import { Pressable, Text, ActivityIndicator, View } from "react-native";

type Variant = "primary" | "secondary" | "text";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
};

// Sendy Errands button — see design.md §9.
export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  fullWidth = true,
}: Props) {
  const container: Record<Variant, string> = {
    primary: "bg-pink-600 active:bg-pink-700",
    secondary: "bg-white border-[1.5px] border-pink-600 active:bg-pink-50",
    text: "bg-transparent",
  };
  const label: Record<Variant, string> = {
    primary: "text-white",
    secondary: "text-pink-600",
    text: "text-pink-600",
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={[
        "h-[52px] rounded-full items-center justify-center px-6",
        fullWidth ? "w-full" : "",
        container[variant],
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : "#E6297A"} />
      ) : (
        <View>
          <Text className={`text-[15px] font-semibold ${label[variant]}`}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
