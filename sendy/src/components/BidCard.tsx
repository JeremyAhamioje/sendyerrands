import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { naira } from '@/lib/format';
import type { Bid } from '@/lib/mock';
import { colors } from '@/lib/theme';

import { Badge, Card, Rating, Verified } from './ui/atoms';
import { Button } from './ui/Button';

/**
 * Vendor bid card (design.md §9 + §11). Trust markers are mandatory on every
 * bid: rating, verified badge and completed-order count.
 */
export function BidCard({
  bid,
  onSelect,
  disabled = false,
  closed = false,
}: {
  bid: Bid;
  onSelect?: () => void;
  /** A selection is already in flight — keep the label, kill the press. */
  disabled?: boolean;
  /** The bidding window has shut, so this bid can no longer be taken. */
  closed?: boolean;
}) {
  return (
    <Card className={`p-4 mb-3 ${bid.best ? 'border-pink-600 bg-pink-50' : ''}`}>
      <View className="flex-row items-center">
        <View
          className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
            bid.best ? 'bg-pink-100' : 'bg-surface'
          }`}
        >
          <Text className="text-ink text-[13px] font-bold">{bid.initials}</Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-ink text-[15px] font-semibold" numberOfLines={1}>
              {bid.vendor}
            </Text>
            {bid.verified ? <View className="ml-1.5"><Verified size={14} /></View> : null}
          </View>
          <View className="flex-row items-center mt-0.5">
            <Rating value={bid.rating} />
            <Text className="text-muted text-[13px] ml-1">· {bid.orders} orders</Text>
          </View>
        </View>

        {bid.best ? <Badge label="BEST PRICE" tone="savings" /> : null}
      </View>

      <View className="flex-row items-end mt-4">
        <View>
          <Text className="text-ink text-[26px] font-bold">{naira(bid.price)}</Text>
          <Text className="text-muted text-[13px]">bid price</Text>
        </View>
        <View className="flex-1" />
        <View className="flex-row items-center bg-surface rounded-full px-3 py-1.5">
          <Ionicons name="time-outline" size={13} color={colors.body} />
          <Text className="text-body text-[13px] font-medium ml-1.5">{bid.etaMinutes} min</Text>
        </View>
      </View>

      <Text className="text-body text-[13px] mt-3 leading-[18px]">{bid.note}</Text>

      <View className="mt-4">
        <Button
          title={closed ? 'Bidding closed' : 'Select this bid'}
          icon={closed ? 'lock-closed' : 'checkmark'}
          variant={bid.best && !closed ? 'primary' : 'secondary'}
          onPress={onSelect}
          disabled={closed || disabled || !onSelect}
        />
      </View>
    </Card>
  );
}
