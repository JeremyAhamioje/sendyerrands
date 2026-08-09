import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { useCreateErrand } from '@/lib/api/hooks';
import { naira } from '@/lib/format';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/** Create Errand (design.md §10) — the first service pillar. */
export default function CreateErrand() {
  const router = useRouter();
  const { activeAddress, signedIn } = useApp();
  const createErrand = useCreateErrand();

  const [task, setTask] = useState('');
  const [details, setDetails] = useState('');
  const [pickupName, setPickupName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [budget, setBudget] = useState('');

  // Mirrors the server's zod schema, so the button doesn't offer to submit
  // something the API will reject.
  const canSubmit =
    task.trim().length >= 3 &&
    pickupName.trim().length >= 2 &&
    pickupAddress.trim().length >= 4 &&
    Boolean(activeAddress);

  const submit = () => {
    if (!activeAddress) return router.push('/addresses');
    if (!signedIn) return router.push('/phone');

    const budgetNaira = Number(budget.replace(/[^\d]/g, ''));

    createErrand.mutate(
      {
        addressId: activeAddress.id,
        task: task.trim(),
        ...(details.trim() ? { details: details.trim() } : {}),
        pickupName: pickupName.trim(),
        pickupAddress: pickupAddress.trim(),
        // The wire is kobo; the field is naira for the human.
        ...(budgetNaira > 0 ? { budgetKobo: budgetNaira * 100 } : {}),
      },
      {
        onSuccess: (order) =>
          router.replace({ pathname: '/track/[id]', params: { id: order.id } }),
      }
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Create errand" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <Input
          label="What do you need done?"
          value={task}
          onChangeText={setTask}
          placeholder="e.g. Buy 2 cartons of Eva Water"
          autoFocus
        />

        <Input
          label="Add details"
          value={details}
          onChangeText={setDetails}
          placeholder="Brands, sizes, quantities — anything the rider should know before shopping…"
          multiline
        />

        <Input
          label="Pick-up from"
          value={pickupName}
          onChangeText={setPickupName}
          placeholder="e.g. Shoprite, Ikeja City Mall"
        />

        <Input
          label="Pick-up address"
          value={pickupAddress}
          onChangeText={setPickupAddress}
          placeholder="Street and area the rider should go to"
        />

        <SelectField
          label="Deliver to"
          icon="location-outline"
          value={activeAddress?.line1}
          placeholder="Choose a drop-off address"
          onPress={() => router.push('/addresses')}
        />

        <Input
          label="Your budget (optional)"
          value={budget}
          onChangeText={setBudget}
          placeholder="0"
          prefix="₦"
          keyboardType="number-pad"
          helper="We'll hold this and refund any change."
        />

        <Text className="text-body text-[15px] mb-2.5">Add photos (optional)</Text>
        <View className="flex-row mb-6">
          {[0, 1, 2].map((i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              className="w-[76px] h-[76px] rounded-md border-[1.5px] border-dashed border-pink-200 bg-pink-50 items-center justify-center mr-3"
            >
              <Ionicons name="camera-outline" size={22} color={colors.pink[400]} />
            </Pressable>
          ))}
        </View>

        {createErrand.isError ? (
          <View className="bg-error/10 rounded-md p-3.5 mb-4">
            <Text className="text-error text-[13px]">
              {createErrand.error instanceof Error
                ? createErrand.error.message
                : 'Could not create this errand.'}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-start bg-surface rounded-md p-3.5">
          <Ionicons name="wallet-outline" size={17} color={colors.body} />
          <Text className="text-body text-[13px] ml-2.5 flex-1 leading-[18px]">
            Your rider pays at the counter with Sendy Errands funds and sends you the receipt. You&apos;re
            only charged for what they actually buy, plus the errand fee.
          </Text>
        </View>
      </ScrollView>

      <StickyBar>
        <Button
          title={createErrand.isPending ? 'Creating…' : 'Find me a rider'}
          trailing={`from ${naira(1500)}`}
          disabled={!canSubmit || createErrand.isPending}
          onPress={submit}
        />
      </StickyBar>
    </Screen>
  );
}
