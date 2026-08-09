import { Image } from 'expo-image';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/lib/theme';

/**
 * The real brand asset: the courier holding a parcel, exported white on
 * transparent from logo.png. Every other icon in assets/images — the store
 * icon, the Android adaptive layers, the splash mark and the favicon — is
 * generated from that same file, so the set can never drift apart.
 */
const MARK = require('../../../assets/images/sendy-mark.png');

type Props = { size?: number; color?: string };

/**
 * Sendy Errands mark (design.md §3).
 *
 * One asset serves every placement. It ships white on transparent and
 * `tintColor` recolours it, so the mark reads correctly on pink, on white, or
 * knocked out of a photo without a second export. That is also why the source
 * must stay white: tinting can only darken a mark that starts at full white.
 */
export function SendyMark({ size = 40, color = colors.pink[600] }: Props) {
  return (
    <Image
      source={MARK}
      style={{ width: size, height: size }}
      contentFit="contain"
      tintColor={color}
      accessibilityLabel="Sendy Errands"
    />
  );
}

/** Courier on a bike — onboarding hero (design.md §8). */
export function CourierOnBike({ size = 220, color = colors.white, opacity = 1 }: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Svg width={size} height={size * 0.62} viewBox="0 0 220 136" fill="none" opacity={opacity}>
      {/* wheels */}
      <Circle cx="46" cy="100" r="26" stroke={color} strokeWidth={4} />
      <Circle cx="170" cy="100" r="26" stroke={color} strokeWidth={4} />
      {/* frame: rear triangle, down tube, top tube, fork */}
      <Path
        d="M46 100 L94 62 L114 100 Z M114 100 L152 62 L94 62 M152 62 L170 100"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* handlebar + saddle */}
      <Path d="M148 57 L164 50 M86 60 L102 60" stroke={color} strokeWidth={4} strokeLinecap="round" />
      {/* cargo box on the rear rack */}
      <Rect x="52" y="36" width="34" height="26" rx="4" stroke={color} strokeWidth={4} />
      {/* rider: capped head, torso, arm to the bars, leg to the pedal */}
      <Circle cx="126" cy="28" r="11" stroke={color} strokeWidth={4} />
      <Path d="M114 23 H138" stroke={color} strokeWidth={4} strokeLinecap="round" />
      <Path
        d="M126 39 L117 66 L114 100 M123 47 L150 58"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* speed lines */}
      <Path
        d="M8 72h22M2 88h14M14 56h16"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.7}
      />
    </Svg>
  );
}
