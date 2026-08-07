import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { View } from 'react-native';

import type { Thumb as ThumbData } from '@/lib/mock';

// Branded placeholder art. Each tone gets a deterministic gradient + glyph so the
// UI never renders an empty grey box during review. Drop a `uri` into the mock
// data and the real photograph takes over — no component changes needed.
const TONES: Record<ThumbData['tone'], { from: string; to: string; icon: keyof typeof Ionicons.glyphMap }> = {
  jollof: { from: '#F26A3D', to: '#C0341C', icon: 'restaurant' },
  swallow: { from: '#E4B171', to: '#B07A3C', icon: 'nutrition' },
  goat: { from: '#C4453C', to: '#7E2019', icon: 'flame' },
  rice: { from: '#E9D8A6', to: '#C4A24C', icon: 'basket' },
  charger: { from: '#8FA3B8', to: '#4A5A6B', icon: 'flash' },
  parcel: { from: '#F569A6', to: '#C21E63', icon: 'cube' },
  pharmacy: { from: '#6FCF97', to: '#219653', icon: 'medkit' },
  market: { from: '#7FC8A9', to: '#3B7A57', icon: 'cart' },
};

export function Thumb({
  data,
  className,
  rounded = 'rounded-md',
  iconSize = 26,
}: {
  data: ThumbData;
  className?: string;
  rounded?: string;
  iconSize?: number;
}) {
  const tone = TONES[data.tone] ?? TONES.parcel;

  if (data.uri) {
    return (
      <View className={`${className} ${rounded} overflow-hidden bg-surface`}>
        <Image source={{ uri: data.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </View>
    );
  }

  return (
    <View className={`${className} ${rounded} overflow-hidden`}>
      <LinearGradient
        colors={[tone.from, tone.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name={tone.icon} size={iconSize} color="rgba(255,255,255,0.92)" />
      </LinearGradient>
    </View>
  );
}
