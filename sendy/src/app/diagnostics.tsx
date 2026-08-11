import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Card } from '@/components/ui/atoms';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { API_BASE_URL, ApiError } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import { authLog, sessionPersistFailed } from '@/lib/diagnostics';
import { useApp } from '@/store/app';

/**
 * Diagnostics.
 *
 * Exists because "I deleted it and installed the new one" could not be checked.
 * Profile showed a hardcoded "v1.0.0 (MVP)" that was the same string in every
 * build ever shipped, so there was no way to tell whether a user reporting a
 * bug was running the fix for it — and several rounds were spent debugging code
 * that was not on the device. Everything here is read from the running build.
 *
 * It also answers the two questions a "random logout" report turns on: what the
 * session did (the event log), and whether the API is reachable and how slowly.
 *
 * Nothing on this screen is a credential. The token is reported as present or
 * absent, never shown, so the whole thing is safe to screenshot.
 */
export default function Diagnostics() {
  const { actor, signedIn, ready } = useApp();
  const [probe, setProbe] = useState<string>('Not checked yet');
  const [probing, setProbing] = useState(false);

  const runProbe = async () => {
    setProbing(true);
    setProbe('Checking…');
    const started = Date.now();
    try {
      // /auth/session with no token: reaches the API and returns quickly either
      // way, so this measures the round trip without needing to be signed in.
      await authApi.session('diagnostics-probe-not-a-token');
      setProbe(`Reachable in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } catch (err) {
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      if (err instanceof ApiError && err.status === 401) {
        // The expected answer — the API replied, which is what we are testing.
        setProbe(`Reachable in ${secs}s`);
      } else if (err instanceof ApiError && err.status === 0) {
        setProbe(`UNREACHABLE after ${secs}s — ${err.code}`);
      } else {
        setProbe(`Replied ${err instanceof ApiError ? err.status : '?'} in ${secs}s`);
      }
    } finally {
      setProbing(false);
    }
  };

  const rows: [string, string][] = [
    ['App version', Constants.expoConfig?.version ?? 'unknown'],
    ['Runtime version', Updates.runtimeVersion ?? 'unknown'],
    ['Update channel', Updates.channel ?? 'none (embedded)'],
    [
      'Running',
      Updates.isEmbeddedLaunch ? 'Embedded bundle (no OTA applied)' : 'Downloaded OTA update',
    ],
    // The single most useful line: it identifies the exact published bundle.
    ['Update ID', Updates.updateId ? Updates.updateId.slice(0, 8) : '—'],
    ['Update published', Updates.createdAt ? Updates.createdAt.toLocaleString() : '—'],
    ['Emergency launch', Updates.isEmergencyLaunch ? (Updates.emergencyLaunchReason ?? 'yes') : 'no'],
    ['API', API_BASE_URL],
    ['Session ready', ready ? 'yes' : 'no'],
    ['Signed in', signedIn ? `yes (${actor})` : 'no'],
    ['Token persisted', sessionPersistFailed ? 'FAILED — will not survive restart' : 'yes'],
  ];

  const events = authLog();

  return (
    <Screen>
      <ScreenHeader title="Diagnostics" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="text-body text-[14px] mb-4 leading-[20px]">
          Screenshot this and send it with any bug report. It contains no personal details.
        </Text>

        <Card className="p-4">
          {rows.map(([label, value]) => (
            <View key={label} className="flex-row py-1.5">
              <Text className="text-muted text-[13px] w-[42%]">{label}</Text>
              <Text className="text-ink text-[13px] flex-1" selectable>
                {value}
              </Text>
            </View>
          ))}
        </Card>

        <Text className="text-muted text-[13px] font-semibold mt-6 mb-2">API REACHABILITY</Text>
        <Card className="p-4">
          <Text className="text-ink text-[13px] mb-3" selectable>
            {probe}
          </Text>
          {/* The API sleeps when idle and the first request afterwards has been
              measured at ~23s. Anything near or above that is the cold start,
              not the device. */}
          <Button
            title={probing ? 'Checking…' : 'Check now'}
            fullWidth={false}
            disabled={probing}
            onPress={runProbe}
          />
        </Card>

        <Text className="text-muted text-[13px] font-semibold mt-6 mb-2">SESSION EVENTS</Text>
        <Card className="p-4">
          {events.length === 0 ? (
            <Text className="text-muted text-[13px]">Nothing recorded yet.</Text>
          ) : (
            events.map((e, i) => (
              <Text key={i} className="text-ink text-[12px] py-0.5" selectable>
                {new Date(e.at).toLocaleTimeString()} · {e.event}
                {e.detail ? ` · ${e.detail}` : ''}
              </Text>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
