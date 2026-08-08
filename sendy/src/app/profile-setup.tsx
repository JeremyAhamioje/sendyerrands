import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Chip } from '@/components/ui/atoms';
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
type Vehicle = 'MOTORBIKE' | 'BICYCLE' | 'TRICYCLE' | 'CAR' | 'VAN' | 'FOOT';

/** What dispatch can actually match on. Plates only exist for the motorised ones. */
const VEHICLES: { value: Vehicle; label: string }[] = [
  { value: 'MOTORBIKE', label: 'Motorbike' },
  { value: 'TRICYCLE', label: 'Keke' },
  { value: 'CAR', label: 'Car' },
  { value: 'VAN', label: 'Van' },
  { value: 'BICYCLE', label: 'Bicycle' },
  { value: 'FOOT', label: 'On foot' },
];

const PLATED: Vehicle[] = ['MOTORBIKE', 'TRICYCLE', 'CAR', 'VAN'];

export default function ProfileSetup() {
  const router = useRouter();
  const { code, role } = useLocalSearchParams<{ code?: string; role?: string }>();
  const asRider = role === 'rider';

  const { phoneNumber, signIn } = useApp();

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [referral, setReferral] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle>('MOTORBIKE');
  const [plate, setPlate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const needsPlate = asRider && PLATED.includes(vehicle);
  const valid =
    first.trim().length > 1 &&
    last.trim().length > 1 &&
    (!needsPlate || plate.trim().length >= 4);

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
        vehicleType: asRider ? vehicle : undefined,
        plateNumber: needsPlate ? plate.trim().toUpperCase() : undefined,
      }),
    onSuccess: async (session) => {
      if (!session.token) {
        setError('That code expired while you were typing. Please request a new one.');
        return;
      }
      await signIn(session.token, asRider ? 'rider' : 'customer');
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
        {asRider ? (
          <>
            <Text className="text-body text-[15px] mb-2.5">What do you ride?</Text>
            <View className="flex-row flex-wrap mb-4">
              {VEHICLES.map((v) => (
                <View key={v.value} className="mb-2 mr-2">
                  <Chip
                    label={v.label}
                    selected={v.value === vehicle}
                    onPress={() => setVehicle(v.value)}
                  />
                </View>
              ))}
            </View>

            {/* A bicycle or a rider on foot has no plate to give. */}
            {needsPlate ? (
              <Input
                label="Plate number"
                value={plate}
                onChangeText={setPlate}
                placeholder="LND-482-GY"
                icon="car-outline"
                helper="Customers use this to identify you at the door."
              />
            ) : null}
          </>
        ) : (
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
