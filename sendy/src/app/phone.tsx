import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';

import { SendyMark } from '@/components/brand/SendyMark';
import { Badge } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/**
 * Auth step 1 — phone entry (design.md §10).
 *
 * Riders and customers are separate accounts on separate tables, so the same
 * number can be both. `?role=rider` decides which one this run of the flow is
 * for, and is carried all the way to the verify call — without it the API
 * always issues a customer token and the rider app stays unreachable.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const asRider = role === 'rider';
  const asVendor = role === 'vendor';
  // The API mints a different kind of token per role, so this has to travel
  // all the way from the entry point to the verify call.
  const authRole = asRider ? 'rider' : asVendor ? 'vendor' : 'customer';

  const { setPhoneNumber } = useApp();
  const [digits, setDigits] = useState('803 123 4567');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = digits.replace(/\D/g, '').length >= 10;

  const sendCode = useMutation({
    mutationFn: () => authApi.requestOtp(digits, authRole),
    onSuccess: () => {
      setPhoneNumber(digits);
      router.push({ pathname: '/otp', params: role ? { role } : {} });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not send the code.'),
  });

  return (
    <Screen>
      <ScreenHeader onBack={() => router.replace('/onboarding')} />

      <View className="px-4 pt-2">
        <View className="w-12 h-12 rounded-xl bg-pink-600 items-center justify-center mb-7">
          <SendyMark size={34} color={colors.white} />
        </View>

        {asRider ? (
          <View className="flex-row mb-3">
            <Badge label="RIDER SIGN-IN" tone="pink" icon="bicycle" />
          </View>
        ) : null}

        <Text className="text-ink text-[28px] font-display leading-[34px]">
          What&apos;s your number?
        </Text>
        <Text className="text-body text-[15px] mt-2.5 leading-[22px]">
          {asRider
            ? "Use the number you registered to ride with. We'll text you a 6-digit code."
            : "We'll text you a 6-digit code to verify it's really you. No spam, promise."}
        </Text>

        <Text className="text-body text-[15px] mt-8 mb-2">Phone number</Text>
        <View
          className={`flex-row items-center h-[56px] rounded-md border-[1.5px] ${
            focused ? 'border-pink-600' : 'border-hairline'
          }`}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change country code"
            className="flex-row items-center px-4 h-full border-r border-hairline"
          >
            {/* Nigerian flag: green · white · green */}
            <View className="flex-row w-6 h-4 rounded-[2px] overflow-hidden mr-2 border border-hairline">
              <View className="flex-1 bg-[#008751]" />
              <View className="flex-1 bg-white" />
              <View className="flex-1 bg-[#008751]" />
            </View>
            <Text className="text-ink text-[15px] font-medium mr-1">+234</Text>
            <Ionicons name="chevron-down" size={14} color={colors.muted} />
          </Pressable>

          <TextInput
            value={digits}
            onChangeText={setDigits}
            keyboardType="phone-pad"
            placeholder="803 123 4567"
            placeholderTextColor={colors.muted}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="flex-1 px-4 text-ink text-[15px]"
            style={{ outlineStyle: 'none' } as never}
          />
        </View>
        {error ? (
          <Text className="text-error text-[13px] mt-2">{error}</Text>
        ) : (
          <Text className="text-muted text-[13px] mt-2">Standard SMS rates may apply.</Text>
        )}
      </View>

      <StickyBar>
        <Button
          title="Continue"
          iconRight="arrow-forward"
          disabled={!valid}
          loading={sendCode.isPending}
          onPress={() => {
            setError(null);
            sendCode.mutate();
          }}
        />
        <Text className="text-muted text-[11px] text-center mt-3">
          By continuing you agree to our Terms & Privacy Policy.
        </Text>
      </StickyBar>
    </Screen>
  );
}
