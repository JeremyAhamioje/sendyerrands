import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { ApiError } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import { useApp } from '@/store/app';

/**
 * Auth step 3 — profile setup, the last gate before Home (design.md §10).
 * Re-verifies the OTP with a name attached, which is what creates the account.
 */
export default function ProfileSetup() {
  const router = useRouter();
  const { code, role } = useLocalSearchParams<{ code?: string; role?: string }>();
  const asRider = role === 'rider';

  const { phoneNumber, signIn } = useApp();

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [referral, setReferral] = useState('');
  const [error, setError] = useState<string | null>(null);

  const valid = first.trim().length > 1 && last.trim().length > 1;

  const createAccount = useMutation({
    mutationFn: () =>
      authApi.verifyOtp({
        phone: phoneNumber,
        code: code ?? '',
        role: asRider ? 'rider' : 'customer',
        firstName: first.trim(),
        lastName: last.trim(),
        email: email.trim() || undefined,
        // Referrals are a customer growth loop; riders have no equivalent.
        referredByCode: asRider ? undefined : referral.trim() || undefined,
      }),
    onSuccess: async (session) => {
      if (!session.token) {
        setError('That code expired while you were typing. Please request a new one.');
        return;
      }
      await signIn(session.token, asRider ? 'rider' : 'customer');
      // A rider created here is PENDING by definition, so verification is the
      // only useful next screen.
      // The dashboard, not the verification wall — see the note in otp.tsx.
      router.replace(asRider ? '/rider' : '/(tabs)/home');
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not finish setting up your account.'),
  });

  return (
    <Screen>
      <ScreenHeader title="Almost there" />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} className="px-4">
        <Text className="text-ink text-[28px] font-display leading-[34px] mt-3">
          {asRider ? <>Set up your{'\n'}rider profile</> : <>Tell us who to{'\n'}deliver to</>}
        </Text>
        <Text className="text-body text-[15px] mt-2.5 mb-8 leading-[22px]">
          {asRider
            ? 'Customers see this name when you pick up and drop off. Verification comes next.'
            : 'Your rider uses this name at the door. You can change it later in Profile.'}
        </Text>

        <Input label="First name" value={first} onChangeText={setFirst} placeholder="Chinedu" autoFocus />
        <Input label="Last name" value={last} onChangeText={setLast} placeholder="Okafor" />
        <Input
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          helper={asRider ? 'For payout statements.' : 'For receipts and order updates.'}
        />
        {asRider ? null : (
          <Input
            label="Referral code (optional)"
            value={referral}
            onChangeText={setReferral}
            placeholder="SENDY-XXXXX"
            helper="Get ₦1,000 off your first delivery."
          />
        )}

        {error ? <Text className="text-error text-[13px]">{error}</Text> : null}
      </ScrollView>

      <StickyBar>
        <Button
          title={asRider ? 'Finish & get verified' : 'Finish & start ordering'}
          disabled={!valid}
          loading={createAccount.isPending}
          onPress={() => {
            setError(null);
            createAccount.mutate();
          }}
        />
      </StickyBar>
    </Screen>
  );
}
