# WhatsApp OTP setup

Sendy sends login codes over the **WhatsApp Cloud API**, straight from Meta — no
reseller in between. SMS via Termii is kept as a fallback only.

## Why not SMS first

Nigerian SMS aggregators will not deliver a single message until you have a
registered business and a **Sender ID approved by the networks** (1–3 business
days). That blocks testing behind paperwork.

Meta gives you a **test sender number the moment you create an app** — no CAC
document, no business verification, no funded wallet. On top of that, WhatsApp
delivery does not depend on the NCC Do-Not-Disturb list, which silently swallows
transactional SMS on a large share of Nigerian numbers.

**The trade-off, stated plainly:** while on the free test number you can only
message **up to 5 recipients**, and each must be added and verified in the Meta
dashboard first. That is enough to demo every flow end to end. Moving to
production — your own sender number, unlimited recipients — *does* require Meta
Business verification. The company documents are still needed eventually; this
just stops them blocking development.

---

## 1. Create the app

Go to **https://developers.facebook.com/apps** → **Create App**.

- Choose **"Connect with customers through WhatsApp"** when asked what you're building
- Attach it to a business portfolio (create one — a personal one is fine for now)

Then open **WhatsApp → API Setup** in the left sidebar.

## 2. Collect three values

On the API Setup screen:

| What | Where |
|---|---|
| **Phone number ID** | Under "From" — the test number Meta gave you. Copy the **ID**, not the phone number. |
| **Access token** | "Temporary access token" at the top. |
| **Recipient** | Under "To" → **Manage phone number list** → add your own number and confirm the code WhatsApp sends you. |

> The temporary token **expires in 24 hours**. Fine for a first test. For
> anything longer see step 5.

## 3. Create the OTP template

**WhatsApp → Manage templates → Create template.**

- **Category:** Authentication ← must be this. Marketing/Utility templates are rejected for OTPs.
- **Name:** `sendy_otp` (must match `WHATSAPP_OTP_TEMPLATE`)
- **Language:** English (`en`)
- Tick **Copy code** for the button
- Meta writes the body copy itself; you cannot freely edit authentication templates

Authentication templates are usually approved in **minutes**, not days — this is
the big difference from an SMS Sender ID.

> Test with a **normal personal WhatsApp account** as the recipient.
> Authentication templates are not delivered from one WhatsApp Business account
> to another, so a business number as the recipient will silently fail.

## 4. Fill in `.env`

```env
OTP_DEV_MODE=false
OTP_CHANNEL=auto

WHATSAPP_PHONE_NUMBER_ID=<from step 2>
WHATSAPP_ACCESS_TOKEN=<from step 2>
WHATSAPP_OTP_TEMPLATE=sendy_otp
WHATSAPP_TEMPLATE_LANG=en
WHATSAPP_TEMPLATE_HAS_BUTTON=true
```

Restart the API and check it registered:

```bash
curl http://localhost:4000/health
# integrations.whatsapp should read "live"
```

Then request a code for a number you added in step 2:

```bash
curl -X POST http://localhost:4000/api/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"08012345678"}'
# → {"data":{"phone":"+2348012345678","channel":"whatsapp", ...}}
```

`channel` tells you what actually delivered it. `"none"` means every channel
failed — the code is printed to the API console so you are never locked out.

## 5. A token that does not expire

The 24-hour token will strand you. For a permanent one:

**business.facebook.com → Business settings → Users → System users** → add a
system user → **Generate new token** → pick your app → grant:

- `whatsapp_business_messaging`
- `whatsapp_business_management`
- `business_management`

Set that as `WHATSAPP_ACCESS_TOKEN`. It does not expire.

## 6. Going to production

1. **Meta Business verification** — this is where the CAC certificate is finally required
2. **Add Sendy's own phone number** as the sender (a number not already on WhatsApp)
3. Remove the 5-recipient cap by moving the app out of development mode

Meta includes **1,000 free service conversations per month**; authentication
conversations are billed per message and land well under Nigerian SMS rates.

---

## Troubleshooting

The API translates Meta's error codes on the way out — check the API console.

| Symptom | Cause |
|---|---|
| `access token expired` | 24-hour temporary token. See step 5. |
| `recipient not in the allowed list` | Number not added under "To". Test numbers only reach the 5 verified recipients. |
| `template not found` | `WHATSAPP_OTP_TEMPLATE` doesn't match the template name, or it isn't Approved yet. |
| `parameter count mismatch` | Your template's button doesn't match `WHATSAPP_TEMPLATE_HAS_BUTTON`. Flip it. |
| Message never arrives, no error | Recipient is a WhatsApp **Business** account. Use a personal one. |

## Fallback to SMS

Set `TERMII_API_KEY` once the business account exists and leave `OTP_CHANNEL=auto`.
WhatsApp is tried first and SMS covers anyone without it. Termii is pinned to the
`dnd` route — the `generic` route is silently dropped for numbers on the NCC
Do-Not-Disturb list, which returns success while the customer gets nothing.
