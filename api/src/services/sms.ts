import { env, features } from '@/config/env';

/**
 * SMS delivery via Termii (https://termii.com) — the common Nigerian choice for
 * transactional SMS and OTP.
 *
 * With no TERMII_API_KEY set, messages are logged instead of sent. That keeps
 * the whole auth flow testable before the merchant account exists — pair it
 * with OTP_DEV_MODE=true and the code also comes back in the API response.
 *
 * To go live:
 *   1. Create a Termii account and fund it.
 *   2. Register a Sender ID ("Sendy") — Termii must approve it first.
 *   3. Put the API key in TERMII_API_KEY and set OTP_DEV_MODE=false.
 */
export async function sendSms(to: string, message: string): Promise<{ sent: boolean; id?: string }> {
  if (!features.sms) {
    console.log(`[sms:stub] → ${to}\n${message}`);
    return { sent: false };
  }

  try {
    const res = await fetch(`${env.TERMII_BASE_URL}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to.replace(/^\+/, ''), // Termii wants the number without the plus
        from: env.TERMII_SENDER_ID,
        sms: message,
        type: 'plain',
        /**
         * 'dnd', not 'generic'.
         *
         * A large share of Nigerian numbers have the NCC Do-Not-Disturb service
         * active, and the 'generic' route is silently dropped for them — the
         * API returns success and the customer never gets a code. The 'dnd'
         * route is the one licensed for transactional messages like OTPs.
         * It costs more per message; that is the price of the code arriving.
         */
        channel: 'dnd',
        api_key: env.TERMII_API_KEY,
      }),
    });

    const payload = (await res.json()) as { message_id?: string; message?: string };

    if (!res.ok) {
      // Never fail a login because the SMS gateway is down — log and carry on.
      console.error('[sms] Termii rejected the message:', payload);
      return { sent: false };
    }

    return { sent: true, id: payload.message_id };
  } catch (err) {
    console.error('[sms] Termii request failed:', err);
    return { sent: false };
  }
}

export function otpMessage(code: string): string {
  return `${code} is your Sendy verification code. It expires in 10 minutes. Never share it with anyone.`;
}
