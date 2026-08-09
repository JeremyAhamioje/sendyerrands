# Sendy Errands — Starter Setup

This is the **Sendy Errands layer** (design tokens + components + navigation) that sits on top of a fresh Expo app. `create-expo-app` writes the generic boilerplate; these files give it the Sendy Errands pink/white identity from `design.md`.

## 1. Create the base app

```bash
npx create-expo-app@latest sendy
cd sendy
```

Choose the default template (TypeScript, Expo Router).

## 2. Install dependencies

```bash
npx expo install nativewind tailwindcss react-native-safe-area-context react-native-reanimated
npx expo install @expo/vector-icons expo-status-bar
```

## 3. Drop in these files

Copy the contents of this starter over the generated project, keeping paths:

```
tailwind.config.js
babel.config.js
metro.config.js
global.css
nativewind-env.d.ts
lib/theme.ts
components/ui/Button.tsx
components/VendorCard.tsx
app/_layout.tsx
app/(tabs)/_layout.tsx
app/(tabs)/index.tsx
app/(tabs)/search.tsx
app/(tabs)/orders.tsx
app/(tabs)/support.tsx
app/(tabs)/profile.tsx
```

Delete any leftover starter screens from `create-expo-app` that you're not using.

## 4. Run it

```bash
npx expo start
```

Install **Expo Go** on your phone and scan the QR code. No Mac, emulator, or Android Studio required to see it live. Edits hot-reload.

## 5. Recommended VS Code extensions

- ESLint + Prettier
- Tailwind CSS IntelliSense (works on NativeWind classes)
- Expo Tools
- React Native Tools

## How this maps to design.md

- `tailwind.config.js` = the color/radius/type tokens (§5–§7). Change a hex here → every screen updates.
- `lib/theme.ts` = the same tokens as TS constants, for nav bars / StatusBar / anything that can't take a className.
- `components/ui/Button.tsx` = §9 button (primary / secondary / text).
- `components/VendorCard.tsx` = §9 vendor card (cover, discount ribbon, verified, rating, ETA).
- `app/(tabs)/_layout.tsx` = §9 bottom tab bar (Home · Search · Orders · Support · Profile).
- `app/(tabs)/index.tsx` = a Home stub wiring header + promo + category chips + section header + vendor list.

To build the next screen, use the **per-screen request template** in `design.md §13`.

## Shipping to iOS without a Mac — Ferome

Android builds anywhere. iOS normally needs a Mac + Xcode. Two ways around that:

- **EAS Build** (`eas build -p ios`) — Expo's cloud build service.
- **Ferome** (https://ferome.dev) — turns this Expo/RN project into a signed `.ipa` on GitHub Actions macOS runners, using your own GitHub account. No Mac, no Xcode license.

You'll still need an **Apple Developer account ($99/yr)** to distribute on the App Store — that's the operational cost listed in the proposal, separate from engineering.

## What's "like a website" vs. what's new

Familiar (your React/Next/Tailwind skills transfer):
- Components, hooks, state, props.
- Expo Router file-based routing ≈ Next.js `app/`.
- NativeWind = Tailwind class names.
- Data layer: fetch your Node API, React Query, etc.

New / needs care:
- `<View>`/`<Text>`/`<Pressable>` instead of DOM elements. No CSS cascade.
- Safe areas, keyboard handling, platform (iOS/Android) differences.
- Device APIs (camera, location, push) via Expo modules.
- Testing on device/simulator, not a browser.
- Build, signing, and store review (where Ferome/EAS come in).

## Suggested build order

1. Auth (phone → OTP → profile)
2. Home (done here — extend it)
3. Vendor detail → cart → checkout → tracking
4. Marketplace + bidding (design.md §11)
5. Rider active delivery, then the admin dashboard (web)
