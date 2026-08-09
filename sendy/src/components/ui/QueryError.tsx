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

  const authProblem = error instanceof ApiError && error.needsSignIn;

  if (authProblem) {
    // A rider token on a customer screen is the case worth naming precisely —
    // "sign in again" would read as a bug to someone who is already signed in.
    const wrongActor = error.status === 403 && actor === 'rider';

    return (
      <EmptyState
        icon="person-circle-outline"
        title={wrongActor ? 'You’re signed in as a rider' : 'Please sign in again'}
        body={
          wrongActor
            ? 'This is the customer side of Sendy Errands. Switch account to see your orders, or head back to the rider app.'
            : 'Your session has expired. Sign in to pick up where you left off.'
        }
      >
        <Button
          title={wrongActor ? 'Switch account' : 'Sign in'}
          fullWidth={false}
          onPress={async () => {
            await signOut();
            router.replace('/phone');
          }}
        />
        {wrongActor ? (
          <Button
            title="Back to rider app"
            variant="text"
            fullWidth={false}
            onPress={() => router.replace('/rider')}
          />
        ) : null}
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
