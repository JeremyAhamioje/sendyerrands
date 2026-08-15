import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { ApiError } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import { useApp } from '@/store/app';

/** Mirrors MIN_LENGTH in the API's lib/password.ts. */
const MIN_PASSWORD = 10;

/**
 * Change your own password.
 *
 * Load-bearing while self-service reset has nowhere to send a code: support
 * generates a password over the phone, which means an operator briefly knows a
 * credential to an account they do not own. Without this screen that stays true
 * for as long as the account exists.
 */
export default function ChangePassword() {
  const router = useRouter();
  const { token } = useApp();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const change = useMutation({
    mutationFn: () =>
      authApi.changePassword({ currentPassword: current, newPassword: next }, token!),
    onSuccess: () => {
      setDone(true);
      setCurrent('');
      setNext('');
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not change your password.'),
  });

  const valid = current.length > 0 && next.length >= MIN_PASSWORD && next !== current;

  return (
    <Screen>
      <ScreenHeader title="Change password" />

      <View className="px-4 pt-4">
        {done ? (
          <View className="bg-success/10 rounded-md p-3.5 mb-5">
            <Text className="text-success text-[14px] font-semibold">Password changed</Text>
            <Text className="text-body text-[13px] mt-1 leading-[19px]">
              Use the new one next time you sign in. You stay signed in here.
            </Text>
          </View>
        ) : null}

        <Input
          label="Current password"
          value={current}
          onChangeText={(v) => {
            setError(null);
            setDone(false);
            setCurrent(v);
          }}
          placeholder="The one you use now"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />
        <Input
          label="New password"
          value={next}
          onChangeText={(v) => {
            setError(null);
            setDone(false);
            setNext(v);
          }}
          placeholder={`At least ${MIN_PASSWORD} characters`}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          helper={
            next.length > 0 && next.length < MIN_PASSWORD
              ? `${MIN_PASSWORD - next.length} more character${MIN_PASSWORD - next.length === 1 ? '' : 's'}`
              : next.length > 0 && next === current
                ? 'That is the password you already have.'
                : 'Length matters more than symbols.'
          }
        />

        {error ? <Text className="text-error text-[13px]">{error}</Text> : null}
      </View>

      <StickyBar>
        <Button
          title="Change password"
          disabled={!valid || change.isPending}
          loading={change.isPending}
          onPress={() => {
            setError(null);
            change.mutate();
          }}
        />
      </StickyBar>
    </Screen>
  );
}
