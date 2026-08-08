import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { ApiError } from '@/lib/api/client';
import { useApplyToSell, useMyVendorApplications } from '@/lib/api/hooks';
import { colors } from '@/lib/theme';

/**
 * Categories ops can actually onboard today. A free-text field here produced
 * nothing useful to sort a queue by, and a long list of aspirational verticals
 * would promise onboarding Sendy cannot yet deliver.
 */
const CATEGORIES = ['Food', 'Groceries', 'Pharmacy', 'Electronics', 'Fashion', 'Other'];

const AREAS = ['Lekki', 'Victoria Island', 'Ikoyi', 'Ikeja', 'Yaba', 'Surulere', 'Ajah', 'Other'];

export default function BecomeVendor() {
  const router = useRouter();

  const { data: existing } = useMyVendorApplications();
  const apply = useApplyToSell();

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pending = existing?.find((a) => a.status === 'PENDING');
  const approved = existing?.find((a) => a.status === 'APPROVED');

  const valid =
    businessName.trim().length > 1 && category !== null && area !== null && phone.trim().length >= 10;

  function submit() {
    setError(null);
    apply.mutate(
      {
        businessName: businessName.trim(),
        category: category!,
        area: area!,
        phone: phone.trim(),
        address: address.trim() || undefined,
      },
      {
        // No navigation: the hook invalidates the applications query, so this
        // screen re-renders into its "Application received" state on its own.
        onError: (err) =>
          setError(
            err instanceof ApiError ? err.message : 'Could not send your application. Try again.'
          ),
      }
    );
  }

  // Someone who already applied gets the status, not a second empty form.
  if (pending || approved) {
    return (
      <Screen>
        <ScreenHeader title="Sell on Sendy" onBack={() => router.back()} />
        <View className="px-4 pt-6">
          <View className="bg-surface rounded-lg p-5 items-center">
            <Ionicons
              name={approved ? 'checkmark-circle' : 'time-outline'}
              size={44}
              color={approved ? colors.success : colors.pink[600]}
            />
            <Text className="text-ink text-[19px] font-bold mt-3 text-center">
              {approved ? 'You’re approved' : 'Application received'}
            </Text>
            <Text className="text-muted text-[15px] mt-2 text-center leading-[22px]">
              {approved
                ? `${approved.businessName} is set up. Our team will call you to add your listings and go live.`
                : `We’re reviewing ${pending!.businessName}. Our team will call ${pending!.area === 'Other' ? 'you' : `you about your ${pending!.area} location`} within two working days.`}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Sell on Sendy" onBack={() => router.back()} />

      <ScrollView contentContainerClassName="px-4 pt-4 pb-32" keyboardShouldPersistTaps="handled">
        <Text className="text-muted text-[15px] leading-[22px] mb-5">
          Tell us about your business and our team will call you back. Setting up your listings is
          free — you only pay commission on what you sell.
        </Text>

        <Input
          label="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="e.g. Mama Nkechi Kitchen"
          icon="storefront-outline"
        />

        <Text className="text-body text-[15px] mb-2">What do you sell?</Text>
        <ChipRow options={CATEGORIES} selected={category} onSelect={setCategory} />

        <Text className="text-body text-[15px] mb-2 mt-4">Where are you based?</Text>
        <ChipRow options={AREAS} selected={area} onSelect={setArea} />

        <View className="mt-4">
          <Input
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="0803 000 0000"
            keyboardType="phone-pad"
            icon="call-outline"
            helper="The number our team should call."
          />

          <Input
            label="Shop address (optional)"
            value={address}
            onChangeText={setAddress}
            placeholder="Street and landmark"
            icon="location-outline"
          />
        </View>

        {error ? <Text className="text-error text-[14px] mt-1">{error}</Text> : null}
      </ScrollView>

      <StickyBar>
        <Button title="Submit application" onPress={submit} disabled={!valid} loading={apply.isPending} />
      </StickyBar>
    </Screen>
  );
}

/** Single-select chips — fewer taps than a picker, and no modal on a short list. */
function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const on = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            className={`px-4 h-10 rounded-full items-center justify-center border-[1.5px] ${
              on ? 'bg-pink-600 border-pink-600' : 'bg-surface border-transparent'
            }`}
          >
            <Text className={`text-[14px] font-semibold ${on ? 'text-white' : 'text-body'}`}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
