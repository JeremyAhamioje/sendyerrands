import { useState, type FormEvent } from 'react';

import { Button, Field, inputClass } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // No navigate() — <App> swaps the tree the moment `signedIn` flips.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-600 text-lg font-bold text-white">
            S
          </div>
          <div>
            <p className="text-lg font-bold leading-tight text-ink">Sendy</p>
            <p className="text-[13px] leading-tight text-muted">Operations dashboard</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-hairline bg-white p-6 shadow-sm"
        >
          <div className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                placeholder="admin@sendy.ng"
                className={inputClass}
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </Field>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-[13px] font-medium text-error"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={busy} className="mt-5 w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-[12px] text-muted">
          Staff access only. Every action is written to the order audit trail.
        </p>
      </div>
    </div>
  );
}
