import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { OrderStage } from '@/lib/mock';
import { colors } from '@/lib/theme';

/**
 * Vertical order status tracker (design.md §9).
 * Done nodes fill pink, the current node gets a ring + halo, future nodes are hairline.
 * Status is never colour-only — every node carries a label (§12a).
 */
export function VerticalStepper({ stages }: { stages: OrderStage[] }) {
  return (
    <View>
      {stages.map((stage, i) => {
        const last = i === stages.length - 1;
        return (
          <View key={stage.label} className="flex-row">
            {/* rail */}
            <View className="items-center w-7">
              {stage.state === 'done' ? (
                <View className="w-[22px] h-[22px] rounded-full bg-pink-600 items-center justify-center">
                  <Ionicons name="checkmark" size={13} color={colors.white} />
                </View>
              ) : stage.state === 'current' ? (
                <View className="w-[22px] h-[22px] rounded-full border-[3px] border-pink-600 items-center justify-center bg-white">
                  <View className="w-2 h-2 rounded-full bg-pink-600" />
                </View>
              ) : (
                <View className="w-[22px] h-[22px] rounded-full border-2 border-hairline bg-white" />
              )}
              {!last ? (
                <View
                  className={`w-[2px] flex-1 my-1 ${
                    stage.state === 'done' ? 'bg-pink-600' : 'bg-hairline'
                  }`}
                />
              ) : null}
            </View>

            {/* label */}
            <View className={`flex-1 pl-3 ${last ? 'pb-0' : 'pb-6'}`}>
              <Text
                className={`text-[15px] ${
                  stage.state === 'pending' ? 'text-muted' : 'text-ink font-semibold'
                }`}
              >
                {stage.label}
              </Text>
              {stage.detail ? (
                <Text className="text-pink-600 text-[13px] font-medium mt-0.5">{stage.detail}</Text>
              ) : stage.time ? (
                <Text className="text-muted text-[13px] mt-0.5">{stage.time}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Compact 3-node horizontal tracker used on the rider's active delivery. */
export function HorizontalStepper({
  steps,
  activeIndex,
}: {
  steps: string[];
  activeIndex: number;
}) {
  return (
    <View className="flex-row items-start">
      {steps.map((label, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        return (
          <View key={label} className="flex-1 items-center">
            <View className="flex-row items-center w-full">
              <View className={`flex-1 h-[3px] ${i === 0 ? 'bg-transparent' : done || current ? 'bg-pink-600' : 'bg-hairline'}`} />
              {done ? (
                <View className="w-6 h-6 rounded-full bg-pink-600 items-center justify-center">
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                </View>
              ) : current ? (
                <View className="w-6 h-6 rounded-full border-[3px] border-pink-600 bg-white items-center justify-center">
                  <View className="w-2 h-2 rounded-full bg-pink-600" />
                </View>
              ) : (
                <View className="w-6 h-6 rounded-full border-2 border-hairline bg-white" />
              )}
              <View className={`flex-1 h-[3px] ${i === steps.length - 1 ? 'bg-transparent' : done ? 'bg-pink-600' : 'bg-hairline'}`} />
            </View>
            <Text
              className={`text-[13px] mt-2 ${current ? 'text-pink-600 font-semibold' : done ? 'text-ink' : 'text-muted'}`}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
