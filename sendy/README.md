# Sendy — Phase 1 MVP

Cross-platform customer **and** rider app for the Sendy logistics / errands /
delivery platform. Built to `design.md` (the design system) and the Phase 1 MVP
scope in the proposal.

**Status: wired to the live API.** The customer flows (browse → cart → checkout
→ track) and the rider loop (sign-in → job list → accept → deliver) run against
real data.

`src/lib/mock.ts` still holds the domain **types** every screen imports, plus
static presentation content that was never server-owned: `PROMOS`, `CATEGORIES`,
`FAQS`, `SEARCH_SUGGESTIONS`, `PARCEL_SIZES`, `PARCEL_TYPES`. Its bulk fixtures
(`VENDORS`, `MENU`, `PRODUCTS`, `ORDERS`, `BIDS`, `RIDER_JOBS`, `EARNINGS`,
`ADDRESSES`) are now dead — nothing imports them since `lib/api/mappers.ts`
started shaping API responses into the same types. They're kept for now as
reference for the fields each screen expects; delete them once the remaining
unwired screens (`marketplace/post-request.tsx`, `rider-verify.tsx`) are done.

---

## Run it

The app needs the API. Start that first, in its own terminal:

```bash
cd ../api && npm run dev     # http://localhost:4000
```

Then:

```bash
npm install
npx expo start               # http://localhost:8081
```

From the Expo prompt, **press `w`** for the browser, or scan the QR code with
**Expo Go** on your phone — no Mac, emulator or Android Studio needed.

The API base URL is resolved at runtime, so a phone on the same Wi-Fi needs no
configuration: `src/lib/api/client.ts` derives your LAN IP from the Expo host
URI. Override it with `EXPO_PUBLIC_API_URL` for standalone builds, which have no
host URI to derive from. See the [root README](../README.md#how-the-app-finds-the-api).

To reach the rider app, sign in via `/phone?role=rider` — the same binary serves
both roles, keyed off the `actor` claim in the JWT.

- Node 22.13+ required (Expo SDK 57).
- Type check: `npx tsc --noEmit`

## Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Expo SDK 57 · React Native 0.86 · React 19 | One codebase → iOS, Android and web |
| Routing | Expo Router (file-based, typed) | Mirrors Next.js `app/` — routes are files |
| Styling | NativeWind 4 (Tailwind for RN) | Design tokens live in `tailwind.config.js` |
| Icons | `@expo/vector-icons` (Ionicons) | Line style, filled when active |
| Type | Plus Jakarta Sans (display) + Inter (UI) | Loaded via `@expo-google-fonts` |

## Where things live

```
src/
  app/                  every file is a route (Expo Router)
    index.tsx           splash
    (tabs)/             customer tab bar: home · search · orders · support · profile
    rider/              rider tab bar:    home · jobs · earnings · me
  components/           VendorCard, ProductCard, BidCard, JobCard, PromoCarousel…
    ui/                 Button, Input, Chip, Badge, Stepper, MapCanvas, Thumb…
    brand/SendyMark     courier logo (line + solid lockups) and the bike scene
  lib/
    theme.ts            tokens as TS constants (for anything that can't take a className)
    mock.ts             all demo data — the shapes the REST API should return
    format.ts           naira / ETA / phone formatting
  store/app.tsx         cart, address and session state (swap bodies for API calls)
```

Change a hex in `tailwind.config.js` and every screen follows.

## Screens built (31 routes)

**Customer** — splash · onboarding · phone · OTP · profile setup · home · search ·
category listing (+ filter sheet) · vendor detail · item detail · cart · checkout ·
payment success · order tracking · orders (active/history) · marketplace ·
post request · bids received · create errand · send a package · addresses ·
wallet · support · profile

**Rider** — home (online toggle) · available jobs · job detail · active delivery
(proof of delivery) · earnings · profile · verification

Reference captures are in [`../screens/`](../screens).

## Notes for review

- **Imagery is placeholder.** `Thumb` renders a branded gradient + glyph per
  category. Drop a `uri` into any item in `mock.ts` and the real photograph
  takes over — no component changes.
- **Maps are illustrative.** `MapCanvas` is a stylised SVG, since live GPS is
  explicitly out of Phase 1 scope. A Google/Mapbox view drops into the same slot.
- **Payments, OTP and auth are all UI-only.** Buttons navigate; nothing calls out.
- Typography: brand font on display headings, system-native stack for body — the
  platform-correct choice for a delivery app.

## Next (Chunk 2 — backend)

Node/Express + REST, auth (phone/OTP), orders, rider assignment, payments, and
the web admin dashboard. `src/lib/mock.ts` is deliberately shaped as the API
contract, so wiring is a per-screen swap rather than a rewrite.
