import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';

/**
 * Each slide's artwork shows the pillar it describes, so the copy never has to
 * explain the picture: the rider reading a route for errands, a parcel at a
 * door for delivery, a bid list for the marketplace.
 */
const SLIDES = [
  {
    art: require('../../assets/images/onboarding-errands.png'),
    title: 'Send someone\nfor anything',
    body: 'Post an errand — buy it, collect it, drop it. A Sendy Errands rider handles the rest.',
  },
  {
    art: require('../../assets/images/onboarding-parcels.png'),
    title: 'Parcels across\nLagos, same day',
    body: 'Point A to point B. Pick a parcel size, add the receiver, and track it live.',
  },
  {
    art: require('../../assets/images/onboarding-bids.png'),
    title: 'Vendors bid,\nyou pick the best',
    body: 'Post what you need. Vendors compete on price and speed. Sendy Errands delivers it.',
  },
];

/** Onboarding carousel (design.md §10) — 3 slides: Errands / Delivery / Marketplace. */
export default function Onboarding() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const ref = useRef<ScrollView>(null);

  /**
   * The artwork is square, so the hero is too — but it has to leave room for a
   * two-line title, the body, the dots and the CTA. Bounding it by height as
   * well as width keeps all of that on screen on a short phone instead of
   * pushing the button off the bottom.
   */
  const hero = Math.min(width - 64, height * 0.42);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));

  const next = () => {
    if (index < SLIDES.length - 1) {
      ref.current?.scrollTo({ x: (index + 1) * width, animated: true });
      setIndex(index + 1);
    } else {
      router.replace('/phone');
    }
  };

  return (
    <Screen>
      <View className="flex-row justify-end px-4 py-2">
        <Pressable onPress={() => router.replace('/phone')} accessibilityRole="button" className="px-3 py-2">
          <Text className="text-muted text-[15px] font-medium">Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {SLIDES.map((slide) => (
          <View
            key={slide.title}
            // Centred rather than top-aligned: the artwork is the anchor, and
            // top-aligning left a dead band between the body copy and the dots.
            style={{ width, height: '100%', justifyContent: 'center' }}
            className="items-center px-8"
          >
            {/* Square card, square source — `cover` trims about 1% rather than
                letterboxing, and these renders have gradient backgrounds that
                would show a seam if they were padded. */}
            <Image
              source={slide.art}
              style={{ width: hero, height: hero, borderRadius: 24 }}
              contentFit="cover"
            />

            <Text className="text-ink text-[28px] font-display text-center mt-10 leading-[36px]">
              {slide.title}
            </Text>
            <Text className="text-body text-[15px] text-center mt-3 leading-[22px]">
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row justify-center mb-7">
        {SLIDES.map((s, i) => (
          <View
            key={s.title}
            className={`h-2 rounded-full mx-1 ${i === index ? 'w-6 bg-pink-600' : 'w-2 bg-pink-200'}`}
          />
        ))}
      </View>

      <View className="px-4 pb-8">
        <Button
          title={index === SLIDES.length - 1 ? 'Get started' : 'Next'}
          iconRight="arrow-forward"
          onPress={next}
        />
      </View>
    </Screen>
  );
}
