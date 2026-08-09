# Sendy

Logistics, errands and marketplace delivery for Lagos. Three deployables in one
repo:

| Directory | What it is | Stack |
|---|---|---|
| [`api/`](api/) | REST backend — orders, riders, payments, admin | Node 24 · Express · Prisma · PostgreSQL |
| [`admin/`](admin/) | Internal operations dashboard (web) | Vite · React · Tailwind |
| [`sendy/`](sendy/) | Customer **and** rider app (one binary, two roles) | Expo SDK 57 · React Native · NativeWind |

Each directory has its own README with the detail. This file is how you get all
three running at once, and what is hosted where.

---

## Running the whole stack locally

Three terminals. **Start the API first** — the other two are useless without it.

```bash
# terminal 1 — API
cd api && npm run dev            # http://localhost:4000

# terminal 2 — admin dashboard
cd admin && npm run dev          # http://localhost:5180

# terminal 3 — mobile app
cd sendy && npx expo start       # http://localhost:8081
```

| Service | URL | Health check |
|---|---|---|
| API | http://localhost:4000/api/v1 | http://localhost:4000/health |
| Admin dashboard | http://localhost:5180 | — |
| Expo dev server | http://localhost:8081 | — |
| Prisma Studio (optional) | http://localhost:5555 | `cd api && npm run prisma:studio` |

First time on a machine: `npm install` in each of the three directories, and
copy `api/.env.example` → `api/.env` with real values. See [`api/README.md`](api/README.md#1-what-you-need-to-do-to-run-it).

### Opening the app

`npx expo start` prints a QR code and waits. From there:

- **Press `w`** — opens the app in your browser at `localhost:8081`. Fastest loop,
  and what the screenshots in this repo were taken against.
- **Scan the QR with Expo Go** on a physical phone. No Mac or Android Studio needed.
- **Press `a` / `i`** for an Android emulator or iOS simulator, if installed.

The rider side is the same app: sign in through `/phone?role=rider`, or tap
through Profile → Rider.

### How the app finds the API

There is no hardcoded localhost. [`sendy/src/lib/api/client.ts`](sendy/src/lib/api/client.ts)
resolves the base URL at runtime, because `localhost` means different things on
different targets:

| Target | Resolves to | Why |
|---|---|---|
| Browser / iOS simulator | `http://localhost:4000` | Same machine |
| Physical phone (Expo Go) | `http://<your-LAN-IP>:4000` | On a phone, `localhost` is the phone. The IP is taken from the Expo host URI that already delivered the bundle. |
| Android emulator | `http://10.0.2.2:4000` | The emulator's alias for the host machine |
| Any build with `EXPO_PUBLIC_API_URL` set | That value | Overrides everything above |

So a phone on the same Wi-Fi works with no configuration. If it can't reach the
API, it's almost always the Windows Firewall blocking inbound 4000 — not the code.

### Ports are pinned on purpose

The admin uses **5180**, not Vite's default 5173, with `strictPort` on. A silent
port move would land on an origin the API's CORS allowlist doesn't include, and
you'd debug a "network error" that is really a rejected preflight. If you change
a port, add the new origin to `CORS_ORIGINS` in `api/.env` **and restart the
API** — CORS is read once at boot.

Current allowlist: `http://localhost:8081`, `:19006`, `:5180`, `:4180`.

---

## Demo accounts

Created by `cd api && npm run seed`. **OTP is `123456`** in development — the
API accepts a fixed code rather than sending one, so no WhatsApp or SMS account
is needed to sign in. In production that is off and a real code is sent.

The app holds **one session at a time**, so signing in as a rider signs you out
as a customer. That is not a bug — each role gets its own token, and a token
from the wrong role is refused by design.

### Customers — sign in at `/phone`

| Number | Who | Good for |
|---|---|---|
| `+2348031234567` | Chinedu Okafor | The full demo — 6 orders, 3 saved addresses, active and past |
| `+2348066704987` | jeremy ahamioje | One order |
| `+2348166677152` | Ada Nwosu | An empty account: first-run states, empty cart, no orders |

### Riders — sign in at `/phone?role=rider`, or Profile → Switch to rider app

| Number | Who | Shows |
|---|---|---|
| `+2348094482210` | Emeka Adeyemi · motorbike | **Approved.** Can go online, accept jobs, complete deliveries |
| `+2348055512345` | Tunde Bakare · keke | **Pending.** Verification banner, disabled availability switch |

### Vendor — sign in at `/phone?role=vendor`, or Profile → Vendor dashboard

| Number | Who | Shows |
|---|---|---|
| `+2348012345678` | Mama Nkechi Kitchen | Verified, 8 listings, open/closed switch, live order queue |

Vendors cannot sign themselves up — verifying an unknown number returns 401. A
vendor exists only because an application was approved, which is where the
business name and area come from. To demo that path, apply from Profile →
Become a vendor, then approve it in the dashboard's Applications tab.

### Admin — the web dashboard, not the app

`admin@sendy.ng`, with the password the seed printed once. Lost it:

```bash
cd api && npm run admin:password
```

---

## What's hosted, and what still needs a host

| Piece | Where it lives now | Status |
|---|---|---|
| API | Render — https://sendyerrands.onrender.com | ✅ Live |
| Database | Supabase, `eu-west-1` | ✅ Live, migrated and seeded |
| **Admin dashboard** | — | ⚠️ **Not hosted yet — the only thing left** |
| Customer / rider app | — | Ships through EAS, not a web host (see below) |

### The admin is the only thing that still needs deploying

[`admin/vercel.json`](admin/vercel.json) is already written — build command,
SPA rewrite, and security headers including `X-Robots-Tag: noindex` so an
internal tool never lands in search results. Vercel is the path of least
resistance:

```bash
cd admin && npx vercel --prod
```

Render works equally well as a **Static Site** (not a Web Service — there's no
server, it's a static bundle):

- Root directory `admin`
- Build command `npm ci && npm run build`
- Publish directory `dist`
- Add a rewrite `/*` → `/index.html` (client-side routing 404s without it)

Either way, two things must follow the deploy or the dashboard will load and
then fail every request:

1. Set `VITE_API_URL=https://sendyerrands.onrender.com/api/v1` as a build-time
   env var. Vite inlines `VITE_*` at build time — setting it afterwards does nothing,
   you have to rebuild.
2. Add the deployed origin to `CORS_ORIGINS` on the Render API service, then
   restart it.

### The mobile app isn't "hosted"

It's distributed, which is a different thing. `eas.json` has the profiles:

```bash
cd sendy
eas build --profile preview    --platform android   # APK for testers
eas build --profile production --platform all       # store builds
```

Android testers can install the APK directly, or through Firebase App
Distribution. iOS needs TestFlight, which needs an Apple Developer account
($99/yr) that doesn't exist yet. Until it does, iOS testing happens in Expo Go.

Set the real API URL in the `preview` and `production` profiles of
[`sendy/eas.json`](sendy/eas.json) before building — they currently point at
placeholder hostnames, and a standalone build has no Expo host URI to fall back on.

---

## Conventions that will bite you

**Money is kobo everywhere.** The API stores, computes and returns integer kobo.
Naira appears only at the render edge, via `naira()` in each client's
`lib/format.ts`. Never put naira into state or send it over the wire — a stray
value renders 100× wrong and reconciles even worse.

**Order status is a state machine.** Transitions are validated server-side in
`api/src/services/orders.ts` and every change appends an immutable `OrderEvent`.
Clients don't get to invent a status; posting an illegal one returns 409.

**Prices come from the database.** Order creation takes product IDs and
quantities — never prices. Same for delivery fees.

---

## Environment notes

`api/.env` holds live Supabase and Paystack credentials and is gitignored. Never
commit it. `.env.example` in each directory documents the shape without values.

Two Postgres URLs are needed because Prisma pools queries but migrates directly:

| Variable | Connection | Port | Used by |
|---|---|---|---|
| `DATABASE_URL` | Transaction pooler, `?pgbouncer=true` | 6543 | The running API |
| `DIRECT_URL` | Session pooler | 5432 | `prisma migrate` only |

Migrations need DDL and advisory locks that a transaction pooler can't proxy,
and transaction mode can't hold the prepared statements Prisma uses by default —
hence the `pgbouncer=true` flag on the first URL and not the second. Note the
pooler username is `postgres.<project-ref>`, not plain `postgres`; changing only
the port on a direct URL fails authentication.

`OTP_DEV_MODE` accepts a fixed OTP instead of sending one. It resolves to **on in
development, off in production** when unset, and should never be `true` against a
public deployment — it lets anyone sign in as any phone number.

---

## Building the Android demo APK

No Google Play account and no fee — an APK installs directly on any Android
phone. Uses EAS Build's free tier.

```bash
cd sendy
npx eas login              # free Expo account
npx eas build:configure    # once — writes extra.eas.projectId into app.json
npx eas build --profile preview --platform android
```

EAS prints a URL when the build finishes. Send that link to a tester, or hand
them the `.apk`; Android will ask them to allow installs from unknown sources.

The `preview` profile builds an APK rather than an app bundle (a bundle only
installs through Play) and bakes in `EXPO_PUBLIC_API_URL`, so the app talks to
the live API rather than your laptop. **That URL is compiled in** — pointing the
app somewhere else means a new build.

`expo-updates` is installed and `preview` publishes to its own channel, so a
JavaScript fix reaches installed testers without rebuilding:

```bash
npx eas update --branch preview --message "fix the thing"
```

Native changes — a new package with native code, an icon, anything in app.json
— still need a fresh build. `runtimeVersion` is tied to the app version so an
incompatible update cannot be delivered to a binary that can't run it.

### Before you demo

**Wake the API.** Render's free tier sleeps after ~15 minutes idle and takes
30–60 seconds to come back. Open
[the health endpoint](https://sendyerrands.onrender.com/health) a minute
beforehand. For real users this is not acceptable — Render Starter ($7/month)
never sleeps, and it is the cheapest thing that makes this feel like a product.
Supabase is unaffected: its free tier pauses after seven days of inactivity,
not fifteen minutes.

**Check sign-in works.** `OTP_DEV_MODE=true` on Render makes every number
accept `123456`, which is how the demo accounts above are meant to be used.

> ⚠️ While `OTP_DEV_MODE` is on, anyone who finds the API URL can sign in as any
> phone number. That is fine against seeded demo data and unacceptable the day
> real customers exist. Set it back to `false` before launch — the code already
> defaults to off in production, so this is only ever on because someone set it.
