# Sendy API

REST backend for the Sendy MVP — errands, pickup & delivery, vendor marketplace,
rider operations and the admin dashboard.

**Node 22 · Express · TypeScript · Prisma · PostgreSQL**

---

## 1. What you need to do to run it

Everything is configured except the database. One step:

```bash
cd api
npm install
# → paste DATABASE_URL and DIRECT_URL into .env  (see below)
npm run db:check                      # verifies the connection first
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Then check it's alive:

```bash
curl http://localhost:4000/health
```

### Getting the two connection strings

Prisma needs **two** URLs against a pooled database:

| Variable | Which connection | Used by |
|---|---|---|
| `DATABASE_URL` | pooled | the running API |
| `DIRECT_URL` | unpooled | `prisma migrate` only |

Migrations need DDL and advisory locks that PgBouncer can't proxy, which is why
they get their own URL. On a plain local Postgres, set both to the same string.

**Supabase** (Project Settings → Database → Connection string):

```
DATABASE_URL = Transaction pooler (port 6543)  + ?pgbouncer=true&connection_limit=1
DIRECT_URL   = Session pooler     (port 5432)
```

Use the **pooler** URLs, not "Direct connection" — direct connections are
IPv6-only unless you've bought Supabase's IPv4 add-on, and most networks are
IPv4. Both poolers work over IPv4.

Prisma talks to Supabase as ordinary Postgres, so you keep Supabase — you just
aren't using its client library.

**Neon / Railway** — use their pooled string for `DATABASE_URL` and the direct
one for `DIRECT_URL`.

**Local** — `postgresql://postgres:postgres@localhost:5432/sendy?schema=public`
for both.

> **Windows note:** if `prisma generate` fails with `EPERM … query_engine-windows.dll.node`,
> a running API process still has the engine loaded. Stop `npm run dev` and retry.

---

## 2. Integration status

| Service | Purpose | Status |
|---|---|---|
| **Paystack** | Card / transfer / USSD payments | ✅ live (test keys) |
| **Cloudinary** | Rider documents, proof of delivery, errand photos | ✅ live |
| **Termii** | OTP delivery by SMS | ⬜ needs `TERMII_API_KEY` |
| **Postgres** | Everything | ⬜ needs `DATABASE_URL` |

Nothing breaks while a service is unconfigured — it degrades:

- No Termii → OTPs are logged to the console. With `OTP_DEV_MODE=true` the code
  also comes back in the API response, so the whole auth flow is testable today.
- No Paystack → card endpoints return `503`; wallet payments still work.
- No Cloudinary → upload-signature endpoint returns `503`.

> **Before going live:** the Paystack keys are TEST keys, and both they and the
> Cloudinary secret were pasted into a chat. Rotate the Cloudinary secret and
> swap to Paystack LIVE keys when you launch — treat what's in `.env` as
> development-only. `.env` is gitignored; `.env.example` is the committed one.

---

## 3. Design decisions worth knowing

**Money is stored in kobo (integers), never naira floats.** `₦4,500` is
`450000`. Float arithmetic on money turns into real refund disputes. The client
formats for display; the server does all the maths in `src/lib/money.ts`.

**The server never trusts a client-supplied total.** `POST /orders` takes product
IDs and quantities only — prices, fees and discounts are recomputed server-side
and that number is what gets charged.

**One `Order` spine for all four pillars.** Food, marketplace, errand and package
orders are all `Order` rows differentiated by `type`, with `ErrandDetail` /
`PackageDetail` hanging off. That keeps rider dispatch, tracking and admin
identical across pillars instead of four parallel code paths.

**Status changes go through a transition table.** `src/services/orders.ts` defines
the only legal moves. A rider can't mark "delivered" on an order that was never
picked up, and every change writes an `OrderEvent` — the customer's tracking
stepper and the admin timeline both render from that audit trail, never from the
status column alone.

**Job claiming is a conditional update, not a read-then-write.** Two riders
tapping "Accept" at the same instant: `updateMany where riderId: null` affects
exactly one row, the other gets a clean 409. No double-assignment, no locks.

**Delivery requires the customer's 4-digit code.** Generated per order, checked
server-side on the `DELIVERED` transition.

**Uploads go straight from phone to Cloudinary.** The API mints a short-lived
signature; binary never passes through Node. Stored URLs are validated to be on
our own Cloudinary account — otherwise a rider could "prove" delivery with any
image on the web.

---

## 4. Endpoints

Base URL: `/api/v1`. Auth is `Authorization: Bearer <jwt>`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/otp/request` | `{ phone, role }` → sends code. Returns `devCode` in dev mode. |
| POST | `/auth/otp/verify` | `{ phone, code, role, firstName?, lastName? }` → JWT. Creates the account on first verify. |
| GET | `/auth/session` | Validates a token on app launch. |

### Customer
| Method | Path | Notes |
|---|---|---|
| GET/PATCH | `/me` | Profile |
| GET/POST | `/me/addresses` | List / create |
| PATCH/DELETE | `/me/addresses/:id` | Update / remove |
| GET | `/me/wallet` | Balance + statement |
| GET | `/vendors` | `?q=&tag=&openOnly=&minRating=&sort=` |
| GET | `/vendors/:slug` | Detail + catalogue by section |
| POST | `/orders` | Food / marketplace order from a cart |
| POST | `/orders/errand` | Create errand |
| POST | `/orders/package` | Create parcel delivery |
| GET | `/orders` | `?status=active\|history` |
| GET | `/orders/:id` | Detail **+ `stepper`** for the tracking screen |
| POST | `/orders/:id/cancel` | Allowed until pickup |

### Marketplace (design.md §11)
| Method | Path | Notes |
|---|---|---|
| GET | `/marketplace/products` | Browse grid |
| POST | `/marketplace/requests` | Post a request for bids |
| GET | `/marketplace/requests` | Your requests + bid counts |
| GET | `/marketplace/requests/:id` | Bids, `?sort=price\|eta\|rating`. `isBestPrice` always marks the genuinely cheapest. |
| POST | `/marketplace/requests/:id/select` | Pick a winner → creates the order |
| GET | `/marketplace/open-requests` | *(admin)* Requests open for bidding |
| POST | `/marketplace/requests/:id/bids` | *(admin)* Submit a bid for a vendor |

### Rider
| Method | Path | Notes |
|---|---|---|
| GET | `/rider/me` | Profile + today's earnings |
| PATCH | `/rider/availability` | Online/offline toggle |
| GET | `/rider/jobs` | Available jobs, `?sort=nearest\|payout` |
| GET | `/rider/jobs/:id` | Job detail |
| POST | `/rider/jobs/:id/accept` | Atomic claim. **Requires APPROVED status.** |
| GET | `/rider/active` | Current delivery |
| POST | `/rider/jobs/:id/status` | `PICKED_UP` / `IN_TRANSIT` / `DELIVERED` (+ `deliveryCode`) |
| GET | `/rider/earnings` | `?range=today\|week\|month` + chart series |
| POST | `/rider/documents` | Verification upload |

### Payments
| Method | Path | Notes |
|---|---|---|
| POST | `/payments/checkout` | `{ orderId, method: WALLET \| PAYSTACK }` |
| POST | `/payments/verify` | Confirms with Paystack directly |
| POST | `/payments/wallet/topup` | Fund the wallet |
| POST | `/payments/webhook` | Paystack callback — raw body, HMAC verified |

### Uploads
| Method | Path | Notes |
|---|---|---|
| POST | `/uploads/signature` | `{ folder }` → Cloudinary direct-upload signature |

### Admin
| Method | Path | Notes |
|---|---|---|
| POST | `/admin/login` | Email + password |
| GET | `/admin/dashboard` | KPI tiles |
| GET | `/admin/riders` | `?status=IN_REVIEW` — verification queue |
| PATCH | `/admin/riders/:id/verify` | Approve / reject / suspend |
| GET | `/admin/orders` | `?status=&type=&q=` |
| GET | `/admin/orders/:id` | Full detail + event timeline |
| POST | `/admin/orders/:id/assign` | Manual rider assignment |
| POST | `/admin/orders/:id/status` | Ops override |
| POST | `/admin/orders/:id/refund` | Refunds to Sendy Wallet |
| GET | `/admin/requests` | Request management |
| PATCH | `/admin/vendors/:id` | Verify vendor / enable bidding |

---

## 5. Seed data

`npm run seed` creates the same records the app's mock module uses, so screens
look identical against the real API:

- **7 vendors** — Mama Nkechi Kitchen, Iya Basira, Suya Republic, Ikeja Grains,
  HealthPlus VI, GadgetHub Lekki, TechPlug NG (with catalogues)
- **Customer** `+2348031234567` (Chinedu Okafor, ₦5,200 wallet, 2 addresses)
- **Rider** `+2348094482210` (Emeka Adeyemi, APPROVED)
- **Admin** `admin@sendy.ng` — the seed prints a generated password once on
  first run, or set `SEED_ADMIN_PASSWORD` to choose your own. Re-seeding never
  resets a password already in use.

Sign in with any of those numbers and OTP code `123456`.

---

## 6. Try the whole flow

```bash
# 1. Get a customer token
curl -s -X POST localhost:4000/api/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"08031234567"}'

curl -s -X POST localhost:4000/api/v1/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"08031234567","code":"123456"}'
# → copy data.token

# 2. Browse vendors
curl -s localhost:4000/api/v1/vendors -H "Authorization: Bearer $TOKEN"

# 3. Place an order, then pay from the wallet
curl -s -X POST localhost:4000/api/v1/payments/checkout \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"orderId":"<id>","method":"WALLET"}'
```

---

## 7. Deploying

Render / Railway / Fly all work:

```
Build:  npm install && npx prisma generate && npm run build && npx prisma migrate deploy
Start:  npm start
```

Set every variable from `.env.example` in the host's dashboard. Then point the
Paystack webhook at `https://<your-api>/api/v1/payments/webhook`.

---

## 8. Not in Phase 1

Per the proposal's exclusions: real-time GPS tracking, live rider navigation,
route optimisation, multi-region support, in-app messaging, ratings & reviews,
inventory management and analytics. The vendor portal is Phase 2 — for now ops
staff submit bids on a vendor's behalf through the admin endpoints.
