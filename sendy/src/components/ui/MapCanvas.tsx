import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors, shadow } from '@/lib/theme';

type Marker = {
  /** Position as a percentage of the canvas, 0–100. */
  x: number;
  y: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'pink' | 'white';
  /** Soft pulsing halo — used for the live rider node. */
  halo?: boolean;
};

/**
 * Stylised map used behind order tracking and rider job screens.
 *
 * Deliberately illustrative, not a real map: design.md excludes live GPS from
 * Phase 1, so this is the visual placeholder that a Google/Mapbox view drops
 * into later without changing the surrounding layout.
 */
export function MapCanvas({
  markers = [],
  route,
  dotted = false,
  className = '',
}: {
  markers?: Marker[];
  /** SVG path in a 393×420 viewBox. */
  route?: string;
  dotted?: boolean;
  className?: string;
}) {
  return (
    <View className={`bg-[#E9EBEA] overflow-hidden ${className}`}>
      <Svg width="100%" height="100%" viewBox="0 0 393 420" preserveAspectRatio="xMidYMid slice">
        {/* land blocks */}
        <Rect x="0" y="0" width="393" height="420" fill="#E9EBEA" />
        <Rect x="196" y="18" width="150" height="120" rx="6" fill="#DDE8DC" />
        <Rect x="16" y="250" width="130" height="150" rx="6" fill="#DCE4EF" />
        <Rect x="230" y="250" width="150" height="120" rx="6" fill="#DDE8DC" />
        <Rect x="20" y="20" width="120" height="90" rx="6" fill="#E3E5E4" />

        {/* roads */}
        <Path
          d="M-20 160h433M-20 300h433M120 -20v460M270 -20v460"
          stroke="#FFFFFF"
          strokeWidth={16}
          strokeLinecap="round"
        />
        <Path
          d="M-20 90h433M330 -20v460"
          stroke="#FFFFFF"
          strokeWidth={9}
          strokeLinecap="round"
        />
        {/* diagonal expressway */}
        <Path d="M-30 430L200 130" stroke="#FFFFFF" strokeWidth={13} strokeLinecap="round" />

        {/* route */}
        {route ? (
          <Path
            d={route}
            stroke={colors.pink[600]}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={dotted ? '1 12' : undefined}
          />
        ) : null}
      </Svg>

      {markers.map((m, i) => (
        <View
          key={i}
          className="absolute items-center justify-center"
          style={{ left: `${m.x}%`, top: `${m.y}%`, transform: [{ translateX: -22 }, { translateY: -22 }] }}
        >
          {m.halo ? (
            <View className="absolute w-[52px] h-[52px] rounded-full bg-pink-600/20" />
          ) : null}
          <View
            style={shadow.card}
            className={`w-11 h-11 rounded-full items-center justify-center border-[3px] border-white ${
              m.tone === 'pink' ? 'bg-pink-600' : 'bg-white'
            }`}
          >
            <Ionicons
              name={m.icon}
              size={19}
              color={m.tone === 'pink' ? colors.white : colors.ink}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The customer tracking route: vendor → rider (live) → home. */
export const TRACK_ROUTE = 'M60 300 L120 300 L120 205 L200 205 L200 120 L300 120';

/** The rider job route: pickup → dropoff. */
export const JOB_ROUTE = 'M75 290 L120 290 L120 150 L270 150 L270 95';
