import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge, Card, Divider } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader, StickyBar } from '@/components/ui/Screen';
import { colors } from '@/lib/theme';

type DocState = 'approved' | 'review' | 'missing';

const DOCS: { id: string; label: string; hint: string; state: DocState }[] = [
  { id: 'nin', label: 'NIN slip or National ID', hint: 'Front side, all corners visible', state: 'approved' },
  { id: 'licence', label: "Rider's licence", hint: 'Must be valid for 3+ months', state: 'approved' },
  { id: 'photo', label: 'Passport photograph', hint: 'Plain background, no cap', state: 'approved' },
  { id: 'bike', label: 'Vehicle papers', hint: 'Registration & proof of ownership', state: 'review' },
  { id: 'guarantor', label: 'Guarantor form', hint: 'Signed, with a valid ID attached', state: 'missing' },
];

const TONE: Record<DocState, { label: string; tone: 'success' | 'info' | 'muted'; icon: keyof typeof Ionicons.glyphMap }> = {
  approved: { label: 'Approved', tone: 'success', icon: 'checkmark-circle' },
  review: { label: 'In review', tone: 'info', icon: 'time' },
  missing: { label: 'Required', tone: 'muted', icon: 'add-circle-outline' },
};

/** Rider verification (design.md §10) — document upload + status. */
export default function RiderVerify() {
  const router = useRouter();
  const done = DOCS.filter((d) => d.state === 'approved').length;
  const pct = Math.round((done / DOCS.length) * 100);

  return (
    <Screen className="bg-surface">
      <View className="bg-white">
        <ScreenHeader title="Rider verification" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* progress */}
        <Card className="p-4">
          <View className="flex-row items-center mb-3">
            <View className="flex-1">
              <Text className="text-ink text-[17px] font-bold">You&apos;re {pct}% verified</Text>
              <Text className="text-muted text-[13px] mt-0.5">
                {done} of {DOCS.length} documents approved
              </Text>
            </View>
            <View className="w-12 h-12 rounded-full bg-pink-50 items-center justify-center">
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.pink[600]} />
            </View>
          </View>
          <View className="h-2 rounded-full bg-surface overflow-hidden">
            <View style={{ width: `${pct}%` }} className="h-full rounded-full bg-pink-600" />
          </View>
        </Card>

        <View className="flex-row items-start bg-info/10 rounded-md p-3.5 mt-4">
          <Ionicons name="information-circle" size={17} color={colors.info} />
          <Text className="text-info text-[13px] ml-2.5 flex-1 leading-[18px]">
            You can browse jobs now, but you can&apos;t accept any until every document is approved.
            Reviews take under 24 hours.
          </Text>
        </View>

        {/* documents */}
        <Text className="text-muted text-[13px] font-semibold mt-6 mb-2.5">DOCUMENTS</Text>
        <Card>
          {DOCS.map((doc, i) => {
            const t = TONE[doc.state];
            return (
              <View key={doc.id}>
                {i > 0 ? <Divider className="mx-4" /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${doc.label}, ${t.label}`}
                  className="flex-row items-center px-4 py-3.5 active:bg-surface"
                >
                  <View
                    className={`w-10 h-10 rounded-md items-center justify-center mr-3 ${
                      doc.state === 'missing' ? 'border-[1.5px] border-dashed border-pink-200 bg-pink-50' : 'bg-surface'
                    }`}
                  >
                    <Ionicons
                      name={doc.state === 'missing' ? 'cloud-upload-outline' : 'document-text-outline'}
                      size={18}
                      color={doc.state === 'missing' ? colors.pink[400] : colors.body}
                    />
                  </View>
                  <View className="flex-1 pr-2">
                    <Text className="text-ink text-[15px] font-medium">{doc.label}</Text>
                    <Text className="text-muted text-[13px] mt-0.5">{doc.hint}</Text>
                  </View>
                  <Badge label={t.label} tone={t.tone} icon={t.icon} />
                </Pressable>
              </View>
            );
          })}
        </Card>

        {/* bank */}
        <Text className="text-muted text-[13px] font-semibold mt-6 mb-2.5">PAYOUT ACCOUNT</Text>
        <Card className="flex-row items-center p-4">
          <View className="w-10 h-10 rounded-full bg-pink-50 items-center justify-center mr-3">
            <Ionicons name="card-outline" size={18} color={colors.pink[600]} />
          </View>
          <View className="flex-1">
            <Text className="text-ink text-[15px] font-semibold">GTBank ••4471</Text>
            <Text className="text-muted text-[13px] mt-0.5">Emeka Adeyemi</Text>
          </View>
          <Text className="text-pink-600 text-[13px] font-semibold">Change</Text>
        </Card>
      </ScrollView>

      <StickyBar>
        <Button
          title="Upload guarantor form"
          icon="cloud-upload-outline"
          onPress={() => router.back()}
        />
      </StickyBar>
    </Screen>
  );
}
