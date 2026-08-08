import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, EmptyState } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { topicBySlug } from '@/lib/help';
import { colors } from '@/lib/theme';

/** One help topic — its articles, expanded one at a time. */
export default function HelpTopicScreen() {
  const { topic: slug } = useLocalSearchParams<{ topic: string }>();
  const router = useRouter();
  const topic = topicBySlug(slug);

  // Opening the first article by default: an accordion where everything is
  // closed looks like a list of links that do nothing.
  const [open, setOpen] = useState<string | null>(topic?.articles[0]?.slug ?? null);

  if (!topic) {
    return (
      <Screen>
        <ScreenHeader title="Help centre" onBack={() => router.back()} />
        <EmptyState
          icon="help-circle-outline"
          title="Topic not found"
          body="That help topic no longer exists."
        >
          <Button title="Back to help" fullWidth={false} onPress={() => router.replace('/help')} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={topic.title} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-muted text-[15px] mb-4">{topic.blurb}</Text>

        {topic.articles.map((article) => {
          const expanded = open === article.slug;

          return (
            <Card key={article.slug} className="p-4 mb-2.5">
              <Pressable
                onPress={() => setOpen(expanded ? null : article.slug)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                className="flex-row items-center"
              >
                <Text className="text-ink text-[15px] font-semibold flex-1 pr-3">{article.q}</Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={17}
                  color={colors.muted}
                />
              </Pressable>

              {expanded ? (
                <View className="mt-3">
                  {article.a.map((paragraph, i) => (
                    <Text
                      key={paragraph.slice(0, 24)}
                      className={`text-body text-[14px] leading-[21px] ${i > 0 ? 'mt-2.5' : ''}`}
                    >
                      {paragraph}
                    </Text>
                  ))}
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
