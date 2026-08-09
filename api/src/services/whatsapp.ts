import { env, features } from '@/config/env';

/**
 * OTP delivery over the WhatsApp Cloud API (Meta, first-party — no reseller).
 *
 * Why this is the default channel for Sendy Errands:
 *
 *   1. You can test TODAY on a personal Meta account. Creating an app gets you
 *      a Meta-provided test sender number immediately, with no CAC document,
 *      no business verification and no funded wallet. SMS aggregators in
 *      Nigeria (Termii included) require a registered business and a network-
 *      approved Sender ID before they will deliver a single message.
 *   2. Nigerian WhatsApp penetration is far higher than SMS engagement, and
 *      delivery does not depend on the NCC Do-Not-Disturb list, which silently
 *      swallows transactional SMS on a large share of numbers.
 *   3. It is cheaper. Meta gives 1,000 free service conversations a month, and
 *      authentication conversations are priced well under Nigerian SMS.
 *
 * The one real constraint: while you are on the free test number you may only
 * message up to 5 recipient phone numbers, and each must be added and verified
 * in the Meta dashboard first. That is enough to demo every flow. Moving to
 * production — your own number, unlimited recipients — does require Meta
 * Business verification, which is where the company documents finally come in.
 *
 * See WHATSAPP_SETUP.md for the click-by-click setup.
 */

type SendResult = { sent: boolean; id?: string; error?: string };

/**
 * Meta requires business-initiated messages to use a pre-approved template.
 * OTPs must use an "authentication" category template, which carries the code
 * in the body and (usually) in a copy-code button — both take the same value.
 */
export async function sendWhatsAppOtp(to: string, code: string): Promise<SendResult> {
  if (!features.whatsapp) {
    console.log(`[whatsapp:stub] → ${to}  code ${code}`);
    return { sent: false, error: 'not configured' };
  }

  // Meta wants the number in E.164 WITHOUT the leading plus: 2348031234567.
  const msisdn = to.replace(/^\+/, '');

  const components: unknown[] = [
    { type: 'body', parameters: [{ type: 'text', text: code }] },
  ];

  /**
   * Authentication templates created through the Meta UI get a "Copy code"
   * button by default, and the API rejects the send if the button component is
   * missing. If you built a template without one, set
   * WHATSAPP_TEMPLATE_HAS_BUTTON=false — sending a button component for a
   * template that has none is an error too.
   */
  if (env.WHATSAPP_TEMPLATE_HAS_BUTTON) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: code }],
    });
  }

  const url = `${env.WHATSAPP_BASE_URL}/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: msisdn,
        type: 'template',
        template: {
          name: env.WHATSAPP_OTP_TEMPLATE,
          language: { code: env.WHATSAPP_TEMPLATE_LANG },
          components,
        },
      }),
    });

    const payload = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } };
    };

    if (!res.ok || payload.error) {
      const detail = payload.error?.error_data?.details ?? payload.error?.message ?? `HTTP ${res.status}`;
      console.error(`[whatsapp] send failed: ${detail}`, explain(payload.error?.code, payload.error?.error_subcode));
      return { sent: false, error: detail };
    }

    return { sent: true, id: payload.messages?.[0]?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[whatsapp] request failed:', message);
    return { sent: false, error: message };
  }
}

/**
 * Meta's error messages are famously unhelpful. These are the four you will
 * actually hit while setting this up, translated into what to do about them.
 */
function explain(code?: number, subcode?: number): string {
  if (code === 190) return '→ access token expired. Temporary tokens last 24h; generate a System User token for a permanent one.';
  if (code === 131030) return '→ recipient not in the allowed list. On a test number you must add and verify each recipient in the Meta dashboard first.';
  if (code === 132001) return '→ template not found. Check WHATSAPP_OTP_TEMPLATE matches the template name exactly, and that it is Approved.';
  if (code === 132000) return '→ parameter count mismatch. Toggle WHATSAPP_TEMPLATE_HAS_BUTTON to match whether your template has a copy-code button.';
  if (code === 133010) return '→ phone number not registered. Complete the phone-number registration step in the dashboard.';
  if (subcode) return `→ subcode ${subcode}`;
  return '';
}
