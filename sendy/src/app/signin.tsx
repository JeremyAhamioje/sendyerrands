import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { ApiError } from '@/lib/api/client';
import { authApi, type Actor } from '@/lib/api/endpoints';
import { useApp } from '@/store/app';

/**
 * Sign in — email and password.
 *
 * Replaces the phone + OTP flow. That made every sign-in depend on a messaging
 * channel: with no WhatsApp or SMS credentials configured, either nobody could
 * get in, or the fixed development code was left enabled and anybody could get
 * in as anybody. A password takes the delivery channel off the hot path — it is
 * only needed by people who have forgotten one.
 */
export default function SignIn() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const actor: Actor = role === 'rider' ? 'rider' : role === 'vendor' ? 'vendor' : 'customer';

  const { signIn, email, setEmail } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const valid = email.trim().length > 3 && password.length > 0;

  const login = useMutation({
    mutationFn: () => authApi.login({ email: email.trim(), password, role: actor }),
    onSuccess: async (session) => {
      await signIn(session.token, actor);
      if (actor === 'vendor') return router.replace('/vendor-app');
      if (actor === 'rider') return router.replace('/rider');
      router.replace('/(tabs)/home');
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not sign you in. Try again.'),
  });

  const label =
    actor === 'rider' ? 'rider account' : actor === 'vendor' ? 'vendor account' : 'account';

  return (
    <Screen>
      <ScreenHeader onBack={() => router.replace('/onboarding')} />

      <View className="px-4 pt-4">
        <Text className="text-ink text-[28px] font-display leading-[34px]">Welcome back</Text>
        <Text className="text-body text-[15px] mt-2.5 mb-8 leading-[22px]">
          Sign in to your {label}.
        </Text>

        <Input
          label="Email"
          value={email}
          onChangeText={(v) => {
            setError(null);
            setEmail(v);
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoFocus
        />
        <Input
          label="Password"
          value={password}
          onChangeText={(v) => {
            setError(null);
            setPassword(v);
          }}
          placeholder="Your password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />

        {error ? <Text className="text-error text-[13px] mb-2">{error}</Text> : null}

        {/*
          Points at support rather than the reset flow, which is built and
          working but has no email provider configured to deliver the code. A
          "Forgot password?" link that silently sends nothing is the worst of
          both: the endpoint answers 200 by design, so the screen would show
          success and the customer would wait for an email that never comes.

          Restore the /forgot-password route the day RESEND_API_KEY is set.
        */}
        <Pressable
          onPress={() => router.push('/help')}
          accessibilityRole="button"
          className="self-start py-2"
        >
          <Text className="text-pink-600 text-[15px] font-semibold">
            Forgot password? Contact support
          </Text>
        </Pressable>

        {/* Vendors cannot self-register — the account exists because ops
            approved an application, so offering "Create one" would lead to a
            form that always refuses them. */}
        {actor === 'vendor' ? (
          <Text className="text-muted text-[13px] mt-4 leading-[20px]">
            Vendor accounts are created when an application is approved. If you have applied and
            not set a password yet, contact support and we will set one up with you.
          </Text>
        ) : (
          <View className="flex-row items-center mt-4">
            <Text className="text-body text-[15px]">New to Sendy Errands?</Text>
            <Pressable
              onPress={() => router.replace({ pathname: '/signup', params: { role: actor } })}
              accessibilityRole="button"
              className="ml-2"
            >
              <Text className="text-pink-600 text-[15px] font-semibold">Create an account</Text>
            </Pressable>
          </View>
        )}
      </View>

      <StickyBar>
        <Button
          title="Sign in"
          disabled={!valid}
          loading={login.isPending}
          onPress={() => {
            setError(null);
            login.mutate();
          }}
        />
      </StickyBar>
    </Screen>
  );
}
