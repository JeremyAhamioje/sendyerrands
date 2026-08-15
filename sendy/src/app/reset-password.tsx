import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input, OtpBoxes } from '@/components/ui/Input';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { ApiError } from '@/lib/api/client';
import { authApi, type Actor } from '@/lib/api/endpoints';
import { useApp } from '@/store/app';

/** Mirrors MIN_LENGTH in the API's lib/password.ts. */
const MIN_PASSWORD = 10;

/**
 * Enter the emailed code and choose a new password.
 *
 * Does not sign anyone in on success. Sending them to the sign-in screen means
 * the new password gets used once, immediately, while it is still in short-term
 * memory — which is the difference between remembering it tomorrow and starting
 * this flow again.
 */
export default function ResetPassword() {
  const router = useRouter();
  const { role, devCode } = useLocalSearchParams<{ role?: string; devCode?: string }>();
  const actor: Actor = role === 'rider' ? 'rider' : role === 'vendor' ? 'vendor' : 'customer';

  const { email } = useApp();
  const [code, setCode] = useState(devCode ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: () =>
      authApi.resetPassword({ email: email.trim(), code, password, role: actor }),
    onSuccess: () => router.replace({ pathname: '/signin', params: { role: actor } }),
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password.');
      setCode('');
    },
  });

  const valid = code.length === 6 && password.length >= MIN_PASSWORD;

  return (
    <Screen>
      <ScreenHeader title="New password" />

      <View className="px-4 pt-4">
        <Text className="text-ink text-[28px] font-display leading-[34px]">Enter the code</Text>
        <Text className="text-body text-[15px] mt-2.5 mb-8 leading-[22px]">
          If an account uses {email.trim() || 'that address'}, a 6-digit code is on its way. It
          expires in 15 minutes.
        </Text>

        <OtpBoxes
          value={code}
          onChange={(v) => {
            setError(null);
            setCode(v);
          }}
        />

        <View className="h-6" />

        <Input
          label="New password"
          value={password}
          onChangeText={(v) => {
            setError(null);
            setPassword(v);
          }}
          placeholder={`At least ${MIN_PASSWORD} characters`}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          helper={
            password.length > 0 && password.length < MIN_PASSWORD
              ? `${MIN_PASSWORD - password.length} more character${MIN_PASSWORD - password.length === 1 ? '' : 's'}`
              : 'Length matters more than symbols.'
          }
        />

        {error ? <Text className="text-error text-[13px]">{error}</Text> : null}

        {devCode ? (
          <Text className="text-muted text-[13px] mt-2">
            Development mode: the code was filled in for you.
          </Text>
        ) : null}
      </View>

      <StickyBar>
        <Button
          title="Set new password"
          disabled={!valid}
          loading={reset.isPending}
          onPress={() => {
            setError(null);
            reset.mutate();
          }}
        />
      </StickyBar>
    </Screen>
  );
}
