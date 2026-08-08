import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OtpBoxes } from '@/components/ui/Input';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { ApiError } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/** Auth step 2 — 6-digit OTP with a resend timer (design.md §10). */
export default function OtpScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const asRider = role === 'rider';
  const asVendor = role === 'vendor';
  const authRole = asRider ? 'rider' : asVendor ? 'vendor' : 'customer';

  const { phoneNumber, signIn } = useApp();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(42);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = useMutation({
    mutationFn: () =>
      authApi.verifyOtp({ phone: phoneNumber, code, role: authRole }),
    onSuccess: async (session) => {
      // A phone with no account yet gets sent to profile setup, which verifies
      // again with a name attached. The code stays valid for that second call.
      if (session.needsProfile || !session.token) {
        router.push({
          pathname: '/profile-setup',
          params: asRider ? { code, role: 'rider' } : { code },
        });
        return;
      }

      // The token's actor has to match what the API issued, or every panel in
      // the destination app 403s.
      await signIn(session.token, authRole);

      if (asVendor) return router.replace('/vendor-app');
      if (!asRider) return router.replace('/(tabs)/home');
      /**
       * Always the dashboard, approved or not.
       *
       * Sending unapproved riders straight to the verification screen made
       * signing in feel like hitting a wall: no dashboard, no way forward, and
       * a back button that left the rider app entirely. The dashboard carries a
       * banner for anyone not yet approved, and the server refuses job
       * acceptance for them anyway (requireApprovedRider), so there is nothing
       * to protect by locking them out of their own home screen.
       */
      router.replace('/rider');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not verify that code.');
      setCode('');
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.requestOtp(phoneNumber, authRole),
    onSuccess: () => {
      setSeconds(42);
      setError(null);
    },
  });

  const timer = `0:${String(seconds).padStart(2, '0')}`;

  return (
    <Screen>
      <ScreenHeader />

      <View className="px-4 pt-4">
        <Text className="text-ink text-[28px] font-display leading-[34px]">Enter the code</Text>
        <View className="flex-row items-center mt-2.5 mb-8">
          <Text className="text-body text-[15px]">Sent to +234 {phoneNumber}</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button" className="ml-2">
            <Text className="text-pink-600 text-[15px] font-semibold">Edit</Text>
          </Pressable>
        </View>

        <OtpBoxes
          value={code}
          onChange={(v) => {
            setError(null);
            setCode(v);
          }}
        />

        {error ? <Text className="text-error text-[13px] mt-4">{error}</Text> : null}

        <View className="flex-row items-center mt-6">
          <Ionicons name="time-outline" size={15} color={colors.muted} />
          {seconds > 0 ? (
            <Text className="text-muted text-[13px] ml-1.5">Resend code in {timer}</Text>
          ) : (
            <Pressable
              onPress={() => resend.mutate()}
              accessibilityRole="button"
              disabled={resend.isPending}
              className="ml-1.5"
            >
              <Text className="text-pink-600 text-[13px] font-semibold">
                {resend.isPending ? 'Sending…' : 'Resend code'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <StickyBar>
        <Button
          title="Verify & continue"
          disabled={code.length < 6}
          loading={verify.isPending}
          onPress={() => verify.mutate()}
        />
      </StickyBar>
    </Screen>
  );
}
