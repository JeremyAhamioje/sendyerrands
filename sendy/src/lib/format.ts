// Naira formatting. design.md §0 — currency is ₦, region Nigeria.

/** 4500 -> "₦4,500" */
export function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

/** 4500 -> "4,500" (when the ₦ is rendered separately) */
export function amount(value: number): string {
  return Math.round(value).toLocaleString('en-NG');
}

/** Minutes range for ETAs: "25–35 min" */
export function eta(min: number, max: number): string {
  return `${min}–${max} min`;
}

/**
 * How long until an ISO timestamp, as a human phrase: "12 min", "3 hr".
 * Returns "now" once it's in the past — callers decide whether that means
 * "closing" or "closed".
 */
export function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return 'now';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  return `${Math.round(mins / 60)} hr`;
}

/** "2:31 PM" from a Date */
export function clock(date: Date): string {
  return date
    .toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toUpperCase()
    .replace(/\s?([AP]M)/, ' $1');
}

/** Mask a phone for display: "+234 803 123 4567" */
export function phone(digits: string): string {
  const d = digits.replace(/\D/g, '').replace(/^234/, '');
  const p = d.padEnd(10, ' ').slice(0, 10);
  return `+234 ${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 10)}`.trimEnd();
}
