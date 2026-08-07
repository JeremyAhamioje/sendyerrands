# Sendy — Phase 1 MVP (UI build)

Cross-platform customer + rider app for the Sendy logistics / errands / delivery
platform. Built to `design.md` (the design system) and the Phase 1 MVP scope in
the proposal.

**Status: Chunk 1 complete — all UI frames built, no backend yet.**
Every screen runs on mock data from `src/lib/mock.ts`.

---

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone — no Mac, emulator or Android
Studio needed. `npx expo start --web` opens it in a browser instead.

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
