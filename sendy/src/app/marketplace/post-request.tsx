import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Card, Chip } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { ApiError } from '@/lib/api/client';
import { useCreateRequest, useUploadImage } from '@/lib/api/hooks';
import { pickImages } from '@/lib/api/uploads';
import { colors } from '@/lib/theme';
import { useApp } from '@/store/app';

const WINDOWS: { label: string; minutes: number }[] = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '24 hours', minutes: 1440 },
];

const MAX_PHOTOS = 3;

/** A photo mid-flight: shown from its local uri, replaced by the hosted url on success. */
type Photo = { localUri: string; url: string | null; failed: boolean };

/** Post request (design.md §11 step 1) — the reverse-auction entry point. */
export default function PostRequest() {
  const router = useRouter();
  const { activeAddress } = useApp();

  const [item, setItem] = useState('');
  const [details, setDetails] = useState('');
  const [qty, setQty] = useState('1');
  const [budget, setBudget] = useState('');
  const [window, setWindow] = useState(WINDOWS[1]!);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const create = useCreateRequest();
  const upload = useUploadImage('request-photos');

  const uploading = photos.some((p) => p.url === null && !p.failed);
  const canPost = item.trim().length >= 3 && Boolean(activeAddress) && !uploading;

  async function addPhotos() {
    setError(null);
    const assets = await pickImages(MAX_PHOTOS - photos.length);
    if (assets.length === 0) return;

    // Placeholders go in immediately so the grid fills while bytes are still
    // moving — on Lagos mobile data an upload is seconds, not milliseconds.
    setPhotos((prev) => [
      ...prev,
      ...assets.map((a) => ({ localUri: a.uri, url: null, failed: false })),
    ]);

    for (const asset of assets) void send(asset);
  }

  async function send(asset: ImagePickerAsset) {
    try {
      const url = await upload.mutateAsync(asset);
      setPhotos((prev) => prev.map((p) => (p.localUri === asset.uri ? { ...p, url } : p)));
    } catch {
      setPhotos((prev) => prev.map((p) => (p.localUri === asset.uri ? { ...p, failed: true } : p)));
    }
  }

  function post() {
    setError(null);

    const nairaBudget = Number(budget.replace(/[^0-9]/g, ''));
    const quantity = Math.max(1, Number(qty.replace(/[^0-9]/g, '')) || 1);

    create.mutate(
      {
        title: item.trim(),
        details: details.trim() || undefined,
        quantity,
        // Naira in the field, kobo on the wire — never the other way round.
        budgetKobo: nairaBudget > 0 ? nairaBudget * 100 : undefined,
        dropoffArea: activeAddress?.city ?? activeAddress?.line1 ?? 'Lagos',
        addressId: activeAddress?.id,
        photoUrls: photos.map((p) => p.url).filter((u): u is string => u !== null),
        bidWindowMinutes: window.minutes,
      },
      {
        onSuccess: (request) =>
          router.replace({ pathname: '/marketplace/bids', params: { id: request.id } }),
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : 'Could not post your request.'),
      }
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Post a request" onBack={() => router.back()} />

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
            <View key={w.label} className="mb-2">
              <Chip
                label={w.label}
                selected={w.label === window.label}
                onPress={() => setWindow(w)}
              />
            </View>
          ))}
        </View>

        <Text className="text-body text-[15px] mb-2.5">Add photos (optional)</Text>
        <View className="flex-row">
          {photos.map((photo) => (
            <View
              key={photo.localUri}
              className="w-[76px] h-[76px] rounded-md overflow-hidden mr-3 bg-surface"
            >
              <Image source={{ uri: photo.localUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />

              {photo.url === null ? (
                <View className="absolute inset-0 items-center justify-center bg-ink/40">
                  {photo.failed ? (
                    <Ionicons name="alert-circle" size={20} color={colors.white} />
                  ) : (
                    <ActivityIndicator color={colors.white} />
                  )}
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                onPress={() => setPhotos((prev) => prev.filter((p) => p.localUri !== photo.localUri))}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/70 items-center justify-center"
              >
                <Ionicons name="close" size={13} color={colors.white} />
              </Pressable>
            </View>
          ))}

          {photos.length < MAX_PHOTOS ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              onPress={addPhotos}
              className="w-[76px] h-[76px] rounded-md border-[1.5px] border-dashed border-pink-200 bg-pink-50 items-center justify-center mr-3"
            >
              <Ionicons name="camera-outline" size={22} color={colors.pink[400]} />
            </Pressable>
          ) : null}
        </View>

        {photos.some((p) => p.failed) ? (
          <Text className="text-error text-[13px] mt-2">
            One of those photos didn’t upload. Remove it, or post without it.
          </Text>
        ) : null}

        <Card className="p-4 mt-6">
          <Text className="text-ink text-[15px] font-semibold mb-2.5">What happens next</Text>
          {[
            'Eligible vendors get your request.',
            'Bids arrive with price, ETA and a short note.',
            'You compare and select a winner.',
            'Sendy assigns a rider and keeps you posted.',
          ].map((step, i) => (
            <View key={step} className="flex-row items-start mb-2">
              <View className="w-5 h-5 rounded-full bg-pink-100 items-center justify-center mr-2.5 mt-0.5">
                <Text className="text-pink-700 text-[11px] font-bold">{i + 1}</Text>
              </View>
              <Text className="text-body text-[13px] flex-1 leading-[19px]">{step}</Text>
            </View>
          ))}
        </Card>

        {error ? <Text className="text-error text-[14px] mt-3">{error}</Text> : null}
        {!activeAddress ? (
          <Text className="text-muted text-[13px] mt-3">
            Choose a drop-off address before posting — vendors bid on delivery too.
          </Text>
        ) : null}
      </ScrollView>

      <StickyBar>
        <Button
          title={uploading ? 'Uploading photos…' : 'Post request'}
          iconRight="arrow-forward"
          disabled={!canPost}
          loading={create.isPending}
          onPress={post}
        />
      </StickyBar>
    </Screen>
  );
}
