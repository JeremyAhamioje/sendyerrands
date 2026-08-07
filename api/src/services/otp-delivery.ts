import { env, features } from '@/config/env';
import { otpMessage, sendSms } from '@/services/sms';
import { sendWhatsAppOtp } from '@/services/whatsapp';

/**
 * Picks how a one-time code actually reaches the customer.
 *
 * Sendy sends OTPs over WhatsApp by default and keeps SMS as the fallback.
 * That order is deliberate: WhatsApp can be tested on a personal Meta account
 * today, whereas Nigerian SMS requires a registered business and a network-
 * approved Sender ID before a single message will be delivered. See
 * services/whatsapp.ts for the full reasoning.
 *
 * OTP_CHANNEL overrides the choice:
 *   auto     — WhatsApp, then SMS if it fails      (default)
 *   whatsapp — WhatsApp only
 *   sms      — SMS only
 *
 * With OTP_DEV_MODE=true nothing is sent at all; the code is fixed and comes
 * back in the API response, so the whole auth flow is demoable with no
 * messaging account of any kind.
 */
export type OtpChannel = 'whatsapp' | 'sms' | 'none';

export async function deliverOtp(phone: string, code: string): Promise<{ channel: OtpChannel; id?: string }> {
  const preference = env.OTP_CHANNEL;

  const tryWhatsApp = preference === 'whatsapp' || preference === 'auto';
  const trySms = preference === 'sms' || preference === 'auto';

  if (tryWhatsApp && features.whatsapp) {
    const result = await sendWhatsAppOtp(phone, code);
    if (result.sent) return { channel: 'whatsapp', id: result.id };
    // Fall through to SMS rather than failing the login outright.
    if (preference === 'whatsapp') {
      console.warn('[otp] WhatsApp failed and OTP_CHANNEL=whatsapp, so no fallback was attempted.');
      return { channel: 'none' };
    }
  }

  if (trySms && features.sms) {
    const result = await sendSms(phone, otpMessage(code));
    if (result.sent) return { channel: 'sms', id: result.id };
  }

  /**
   * Nothing is configured, or every channel failed. The code is logged so a
   * developer can still complete the flow, and the caller carries on: a
   * messaging outage must never be the reason a customer cannot sign in.
   */
  console.log(`[otp] no channel delivered a code to ${phone}. Code: ${code}`);
  return { channel: 'none' };
}
