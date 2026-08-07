import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge, Card, Divider } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MapCanvas } from '@/components/ui/MapCanvas';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { useAddAddress } from '@/lib/api/hooks';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

/** Address picker (design.md §10) — map region + saved addresses. */
export default function Addresses() {
  const router = useRouter();
  const { addresses, activeAddress, setActiveAddress } = useApp();
  const addAddress = useAddAddress();

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('Home');
  const [line1, setLine1] = useState('');
  const [landmark, setLandmark] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');

  // Mirrors the server's zod schema.
  const canSave =
    label.trim().length >= 1 &&
    line1.trim().length >= 4 &&
    contact.trim().length >= 2 &&
    phone.replace(/\D/g, '').length >= 10;

  const save = () => {
    addAddress.mutate(
      {
        label: label.trim(),
        line1: line1.trim(),
        ...(landmark.trim() ? { landmark: landmark.trim() } : {}),
        contact: contact.trim(),
        phone: phone.trim(),
        // The first address a customer saves becomes their default.
        isDefault: addresses.length === 0,
      },
      {
        onSuccess: (created) => {
          setActiveAddress(created.id);
          setAdding(false);
          setLine1('');
          setLandmark('');
          setContact('');
          setPhone('');
        },
      }
    );
  };

  return (
    <Screen className="bg-surface">
      <View className="bg-white">
        <ScreenHeader title="Delivery address" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* map */}
        <View className="h-[180px] relative">
          <MapCanvas
            className="absolute inset-0"
            markers={[{ x: 50, y: 45, icon: 'location', tone: 'pink' }]}
          />
          <Pressable
            accessibilityRole="button"
            className="absolute bottom-3 right-3 flex-row items-center bg-white rounded-full px-4 h-10"
          >
            <Ionicons name="navigate" size={15} color={colors.pink[600]} />
            <Text className="text-ink text-[13px] font-semibold ml-2">Use current location</Text>
          </Pressable>
        </View>

        {/* saved */}
        <View className="p-4">
          <Text className="text-muted text-[13px] font-semibold mb-2.5">SAVED ADDRESSES</Text>

          {addresses.length === 0 ? (
            <Card className="p-6 items-center">
              <Ionicons name="location-outline" size={26} color={colors.muted} />
              <Text className="text-ink text-[15px] font-semibold mt-2">No addresses yet</Text>
              <Text className="text-muted text-[13px] mt-1 text-center">
                Add one so a rider knows where to bring your order.
              </Text>
            </Card>
          ) : (
            <Card>
              {addresses.map((addr, i) => {
                const selected = addr.id === activeAddress?.id;
                return (
                  <View key={addr.id}>
                    {i > 0 ? <Divider className="mx-4" /> : null}
                    <Pressable
                      onPress={() => setActiveAddress(addr.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      className="flex-row items-start p-4 active:bg-surface"
                    >
                      <View
                        className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
                          selected ? 'bg-pink-600' : 'bg-pink-50'
                        }`}
                      >
                        <Ionicons
                          name={
                            addr.label === 'Home'
                              ? 'home-outline'
                              : addr.label === 'Office'
                                ? 'briefcase-outline'
                                : 'location-outline'
                          }
                          size={17}
                          color={selected ? colors.white : colors.pink[600]}
                        />
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-ink text-[15px] font-semibold mr-2">{addr.label}</Text>
                          {addr.isDefault ? <Badge label="Default" tone="muted" /> : null}
                        </View>
                        <Text className="text-body text-[13px] mt-1 leading-[18px]">
                          {addr.line1}
                          {addr.line2 ? `, ${addr.line2}` : ''}
                        </Text>
                        <Text className="text-muted text-[13px] mt-1">
                          {addr.contact} · {addr.phone}
                        </Text>
                      </View>

                      {selected ? (
                        <View className="w-6 h-6 rounded-full bg-pink-600 items-center justify-center ml-2">
                          <Ionicons name="checkmark" size={15} color={colors.white} />
                        </View>
                      ) : (
                        <View className="w-6 h-6 rounded-full border-2 border-hairline ml-2" />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          )}

          {adding ? (
            <Card className="p-4 mt-4">
              <Text className="text-ink text-[15px] font-semibold mb-3">New address</Text>

              <Input label="Label" value={label} onChangeText={setLabel} placeholder="Home, Office…" />
              <Input
                label="Street address"
                value={line1}
                onChangeText={setLine1}
                placeholder="12 Adeola Odeku St, Victoria Island"
                autoFocus
              />
              <Input
                label="Landmark (optional)"
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Opposite the blue gate"
                helper="Landmarks find a door faster than street numbers here."
              />
              <Input label="Contact name" value={contact} onChangeText={setContact} placeholder="Who should the rider ask for?" />
              <Input
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="0803 123 4567"
              />

              {addAddress.isError ? (
                <View className="bg-error/10 rounded-md p-3 mb-3">
                  <Text className="text-error text-[13px]">
                    {addAddress.error instanceof Error
                      ? addAddress.error.message
                      : 'Could not save this address.'}
                  </Text>
                </View>
              ) : null}

              <View className="flex-row" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Button
                    title="Cancel"
                    variant="secondary"
                    onPress={() => setAdding(false)}
                    disabled={addAddress.isPending}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    title={addAddress.isPending ? 'Saving…' : 'Save address'}
                    onPress={save}
                    disabled={!canSave || addAddress.isPending}
                  />
                </View>
              </View>
            </Card>
          ) : (
            <Pressable
              onPress={() => setAdding(true)}
              accessibilityRole="button"
              className="flex-row items-center justify-center bg-white rounded-lg border border-dashed border-pink-200 py-4 mt-4 active:bg-pink-50"
            >
              <Ionicons name="add-circle-outline" size={19} color={colors.pink[600]} />
              <Text className="text-pink-600 text-[15px] font-semibold ml-2">Add a new address</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <StickyBar>
        <Button title="Use this address" onPress={() => router.back()} disabled={!activeAddress} />
      </StickyBar>
    </Screen>
  );
}
