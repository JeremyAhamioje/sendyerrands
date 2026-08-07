/**
 * The API speaks kobo integers everywhere. Converting only here, at the render
 * edge, is what stops a ₦4,500 plate showing as ₦450,000.
 */
export function naira(kobo: number | null | undefined): string {
  const value = (kobo ?? 0) / 100;
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

/** "6 Aug, 14:32" — Lagos-readable, no year unless it isn't this year. */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "3m ago", "2h ago" — for how stale a live order is. */
export function relative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';

  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** RIDER_ASSIGNED -> "Rider assigned" */
export function humanise(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function fullName(p: { firstName: string; lastName: string } | null | undefined): string {
  if (!p) return '—';
  return `${p.firstName} ${p.lastName}`.trim();
}

export function initials(p: { firstName: string; lastName: string } | null | undefined): string {
  if (!p) return '??';
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
}
