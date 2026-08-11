import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/atoms';
import { ApiError } from '@/lib/api/client';
import { useApp } from '@/store/app';

/**
 * The failure state for any screen that loads from the API.
 *
 * Exists because every screen used to render the same "Check your connection"
 * message for every error. That is wrong for the most common failure in
 * practice: a signed-in rider opening a customer screen gets 403, which is not
 * a connection problem and which no amount of tapping Retry will fix. The user
 * is left with a button that cannot work and no way to discover why.
 *
 * So the remedy is chosen from the error: re-authenticate for 401/403, retry
 * for anything else.
 */
export function QueryError({
  error,
  onRetry,
  noun = 'that',
}: {
  error: unknown;
  onRetry: () => void;
  /** What failed to load, e.g. "your orders". Used in the heading. */
  noun?: string;
}) {
  const router = useRouter();
  const { signOut, actor } = useApp();

  /**
   * 403 is NOT a reason to sign anybody out.
   *
   * Both codes used to land here and both offered a button that called
   * signOut(). But a 403 means the token is perfectly valid and simply belongs
   * to another kind of account — a rider or vendor token on a customer screen.
   * Throwing that token away is destructive and it is also the loudest symptom
   * users reported as "the app randomly logged me out": home renders, a panel
   * appears saying the session expired, they tap the only button on it, and
   * they are back at the OTP screen with a working session deleted.
   *
   * Only 401 — the server saying the token itself is dead — may sign out.
   */
  const sessionDead = error instanceof ApiError && error.status === 401;
  const wrongAccountType = error instanceof ApiError && error.status === 403;

  if (sessionDead) {
    return (
      <EmptyState
        icon="person-circle-outline"
        title="Please sign in again"
        body="Your session has expired. Sign in to pick up where you left off."
      >
        <Button
          title="Sign in"
          fullWidth={false}
          onPress={async () => {
            await signOut();
            router.replace('/phone');
          }}
        />
      </EmptyState>
    );
  }

  if (wrongAccountType) {
    // Name the account they are actually on, and send them to the app that
    // matches it. Nothing here touches the stored session.
    const home =
      actor === 'rider'
        ? { label: 'Back to rider app', to: '/rider' as const }
        : actor === 'vendor'
          ? { label: 'Back to vendor dashboard', to: '/vendor-app' as const }
          : { label: 'Back to home', to: '/(tabs)/home' as const };

    return (
      <EmptyState
        icon="person-circle-outline"
        title={
          actor === 'rider'
            ? 'You’re signed in as a rider'
            : actor === 'vendor'
              ? 'You’re signed in as a vendor'
              : 'This isn’t available on your account'
        }
        body={
          actor === 'customer'
            ? 'Your account does not have access to this part of Sendy Errands.'
            : 'This is the customer side of Sendy Errands, and your account is a different type. You are still signed in.'
        }
      >
        <Button title={home.label} fullWidth={false} onPress={() => router.replace(home.to)} />
        <Button
          title="Sign in with another number"
          variant="text"
          fullWidth={false}
          onPress={async () => {
            await signOut();
            router.replace('/phone');
          }}
        />
      </EmptyState>
    );
  }

  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={`Can’t load ${noun}`}
      body={
        error instanceof ApiError && error.status === 0
          ? 'Check your connection and try again.'
          : error instanceof ApiError
            ? error.message
            : 'Something went wrong. Please try again.'
      }
    >
      <Button title="Retry" fullWidth={false} onPress={onRetry} />
    </EmptyState>
  );
}
