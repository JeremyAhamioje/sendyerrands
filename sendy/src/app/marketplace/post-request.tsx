import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, Chip } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

const WINDOWS = ['30 min', '1 hour', '3 hours', '24 hours'];

/** Post request (design.md §11 step 1) — the reverse-auction entry point. */
export default function PostRequest() {
  const router = useRouter();
  const { activeAddress } = useApp();
  const [item, setItem] = useState('Original iPhone 15 Pro charger (20W USB-C)');
  const [details, setDetails] = useState('');
  const [qty, setQty] = useState('1');
  const [budget, setBudget] = useState('25000');
  const [window, setWindow] = useState('1 hour');

  return (
    <Screen>
      <ScreenHeader title="Post a request" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row items-start bg-pink-50 rounded-md p-3.5 mb-5">
          <Ionicons name="information-circle" size={18} color={colors.pink[600]} />
          <Text className="text-pink-700 text-[13px] ml-2 flex-1 leading-[18px]">
            Vendors bid with a price and ETA. You pick the winner — nothing is charged until you do.
          </Text>
        </View>

        <Input
          label="What do you need?"
          value={item}
          onChangeText={setItem}
          placeholder="e.g. Original iPhone 15 charger"
        />

        <Input
          label="Add details (optional)"
          value={details}
          onChangeText={setDetails}
          placeholder="Brand, model, colour, condition — anything vendors should know…"
          multiline
        />

        <View className="flex-row">
          <View className="flex-1 mr-3">
            <Input label="Quantity" value={qty} onChangeText={setQty} keyboardType="number-pad" />
          </View>
          <View className="flex-1">
            <Input
              label="Budget (optional)"
              value={budget}
              onChangeText={setBudget}
              keyboardType="number-pad"
              prefix="₦"
            />
          </View>
        </View>

        <SelectField
          label="Deliver to"
          icon="location-outline"
          value={activeAddress?.line1}
          placeholder="Choose a drop-off address"
          onPress={() => router.push('/addresses')}
        />

        <Text className="text-body text-[15px] mb-2.5">How long should bidding stay open?</Text>
        <View className="flex-row flex-wrap mb-5">
          {WINDOWS.map((w) => (
            <View key={w} className="mb-2">
              <Chip label={w} selected={w === window} onPress={() => setWindow(w)} />
            </View>
          ))}
        </View>

        <Text className="text-body text-[15px] mb-2.5">Add photos (optional)</Text>
        <View className="flex-row">
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

        <Card className="p-4 mt-6">
          <Text className="text-ink text-[15px] font-semibold mb-2.5">What happens next</Text>
          {[
            'Eligible vendors get your request instantly.',
            'Bids arrive with price, ETA and a short note.',
            'You compare and select a winner.',
            'Sendy assigns a rider and you track it live.',
          ].map((step, i) => (
            <View key={step} className="flex-row items-start mb-2">
              <View className="w-5 h-5 rounded-full bg-pink-100 items-center justify-center mr-2.5 mt-0.5">
                <Text className="text-pink-700 text-[11px] font-bold">{i + 1}</Text>
              </View>
              <Text className="text-body text-[13px] flex-1 leading-[19px]">{step}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      <StickyBar>
        <Button
          title="Post request"
          iconRight="arrow-forward"
          disabled={!item.trim()}
          onPress={() => router.replace('/marketplace/bids')}
        />
      </StickyBar>
    </Screen>
  );
}
