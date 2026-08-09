# Sendy Errands Operations dashboard

Internal web dashboard for the Sendy Errands API. Vite + React + TypeScript + Tailwind.

## Running it

```bash
npm install
npm run dev          # http://localhost:5180
```

The API must be running on `http://localhost:4000` (`cd ../api && npm run dev`).
Point elsewhere with `VITE_API_URL` in `.env`.

Sign in with the admin the API seed created — `admin@sendy.ng` unless you set
`SEED_ADMIN_EMAIL`. Its password is **not** in this repo: the seed prints it once
when it creates the account and stores only a bcrypt hash.

Lost it? It cannot be recovered, and re-running the seed will not reset it (the
upsert deliberately leaves an existing password alone). Set a new one:

```bash
cd ../api
npm run admin:password
```

It prompts for the email (defaulting to `admin@sendy.ng`) and then for the
password twice, with the typing hidden. Minimum 12 characters — this account can
refund money and the dashboard is on a public URL.

Nothing secret goes on the command line, so there is no shell history to worry
about and no cross-platform quoting to get wrong. `ADMIN_EMAIL` and
`ADMIN_PASSWORD` still work as environment variables for non-interactive use;
set `DATABASE_URL` too if you need to target a database other than the one in
`.env`.

The change takes effect immediately — no redeploy of this dashboard and no
restart of the API, since the hash is read from the database per request.
Existing sessions are unaffected: their JWTs stay valid until they expire.

> **Port 5180, not Vite's default 5173.** 5173 collides with other projects on
> this machine, and `strictPort` is on so a clash fails loudly instead of
> silently moving to a port the API's CORS allowlist doesn't include. If you
> change it, add the new origin to `CORS_ORIGINS` in `api/.env` **and restart
> the API** — it reads CORS once at boot.

## What's here

| Page | Does |
|---|---|
| Dashboard | Six KPI tiles + live orders. Polls every 30s. |
| Orders | Filter by status/type/reference. Drawer per order: full breakdown, audit trail, assign rider, override status, refund to wallet. |
| Riders | Verification queue. Approve / reject / suspend with a note, and view uploaded documents. |
| Requests | Marketplace requests with their bids, lowest flagged. |
| Vendors | Toggle verified / can-bid / open. |

## Conventions

**Money is kobo everywhere.** The API returns kobo integers; `naira()` in
`src/lib/format.ts` converts at the render edge only. Never put naira into
state — a stray value renders 100× wrong.

**The order status dropdown mirrors the server's transition table**
(`api/src/services/orders.ts`). The API is still the authority and rejects
illegal jumps, but offering only legal moves stops ops picking something that
will bounce. If that table changes, update `TRANSITIONS` in
`src/components/OrderDrawer.tsx` to match.

**Vendors load from `GET /admin/vendors`, not the public `GET /vendors`.**
The public one caps `limit` at 50, so management would silently stop seeing
vendors past the cap.

## Known advisory

`npm audit` reports a high-severity advisory against `react-router`:
*RSC Mode CSRF Bypass*. It applies to React Router's **RSC mode**, which needs a
server runtime and explicit opt-in. This dashboard is a client-only SPA using
`BrowserRouter` — there is no server, no RSC, and no server actions, so the
vulnerable path is not reachable.

There is no patched release to move to: the advisory covers `>=7.12.0 <8.3.0`
and 7.18.2 is currently the latest published version. Downgrading below 7.12.0
would forfeit seven minor versions of other fixes to silence an advisory that
does not apply. Re-check when 8.3.0 (or a 7.x patch) ships and bump then.
