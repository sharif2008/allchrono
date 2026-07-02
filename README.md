# AllChrono — The Verified Trade Pipeline

A two-surface **NestJS + Next.js** application for a trusted luxury-watch marketplace.
It demonstrates domain modelling / DDD, a transactional trade **state machine**, hard
invariants, **escrow idempotency**, and a blockchain-style **append-only passport ledger**
with a SHA-256 hash chain.

> Escrow, payments, KYC, shipping and the "blockchain" are all **simulated** and clearly
> documented as stubs. Nothing here touches real money, a real chain, or a real carrier.

---

## Architecture

```
┌──────────────────────────────┐        HTTP/JSON + JWT        ┌───────────────────────────────┐
│         apps/web (Next.js)    │  ───────────────────────────▶ │        apps/api (NestJS)       │
│                               │                               │                                │
│  (public)  catalogue + detail │                               │  identity  (JWT, roles)        │
│            Server Components  │                               │  watches   (listings)          │
│  (buyer)   checkout + trade   │                               │  trading   (Trade AGGREGATE +  │
│  (seller)  dashboard + ship   │                               │             state machine)     │
│  (admin)   ops + verdicts     │                               │  authentication (verdicts)     │
│                               │                               │  escrow    (fund/release +     │
│  lib: api-client / auth /     │                               │             idempotency)       │
│       idempotency             │                               │  passport  (hash-chain ledger) │
└──────────────────────────────┘                               └───────────────┬────────────────┘
                                                                                │ Prisma
                                                                        ┌───────▼────────┐
                                                                        │  PostgreSQL 16 │
                                                                        └────────────────┘
```

The **Trade aggregate** (`apps/api/src/modules/trading/domain/trade.entity.ts`) is the
transactional spine. Every lifecycle rule lives in the domain; controllers are thin.

### Trade state machine

```
DRAFT ──submit──▶ PENDING_AUTH ──PASS──▶ AUTH_PASSED ──fund──▶ ESCROW_FUNDED ──ship──▶ SHIPPED
  │                   │  │                    │                     │                    │
 cancel             cancel FAIL            expire               refundPreShip       ┌────┴─────┐
  ▼                   ▼  ▼                    ▼                     ▼             DELIVERED  LOST_IN_TRANSIT
CANCELLED          CANCELLED AUTH_FAILED    EXPIRED         REFUNDED_PRE_SHIP        │
                                                                                ┌────┴─────┐
                                                                            RELEASED   DISPUTED
                                                                                       │   │
                                                                                  RELEASED  REFUNDED_POST_DELIVERY
```

Terminal states: `AUTH_FAILED, RELEASED, REFUNDED_PRE_SHIP, REFUNDED_POST_DELIVERY, EXPIRED,
CANCELLED, LOST_IN_TRANSIT`.

---

## Run it — from clone to running app

There are two supported ways to run. Both end up with the DB **migrated** and **seeded**.

- **Mode A — everything in Docker** (Postgres + API + web, migration + seed run automatically).
- **Mode B — Postgres in Docker, API & web run separately** on your machine.

| | Web | API | Postgres | Passport demo |
| --- | --- | --- | --- | --- |
| URL | http://localhost:3000 | http://localhost:3001 | localhost:5433 | http://localhost:3001/passport/by-serial/RX-300003 |

---

### Mode A · everything in Docker (one command)

```bash
docker compose up --build
```

That single command:

1. starts **Postgres 16** and waits until it is healthy,
2. runs `prisma migrate deploy` (**migration**),
3. runs `prisma db seed` (**seed**: 4 users + 3 watches),
4. starts the **API** on `:3001`, then the **web** app on `:3000`.

The migrate + seed + serve sequence is the API container's start command in
`docker-compose.yml`:

```yaml
command: sh -c "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"
```

Useful Docker commands:

```bash
docker compose up --build -d      # run detached (in the background)
docker compose logs -f api        # follow API logs (watch migrate + seed + boot)
docker compose restart api        # re-run migrate + seed + boot (re-seeds demo data)
docker compose down               # stop containers (DB volume is kept)
docker compose down -v            # stop AND wipe the Postgres volume (fresh DB next up)
```

> Re-seeding is safe: the seed script clears the demo tables first, so
> `docker compose restart api` (or `down` then `up`) always gives a clean dataset.

---

### Mode B · Postgres in Docker, API & web separate (with migrate + seed)

Recommended for active development. Postgres still runs in Docker (no local install),
while the API and web run natively for fast reloads.

**One command** (installs deps, creates env files, starts Postgres, migrates, seeds, runs both apps):

```bash
# macOS / Linux / Git Bash / WSL
bash scripts/dev.sh      # or: pnpm dev:local
```

```powershell
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
```

<details>
<summary>…or the equivalent steps by hand</summary>

```bash
# 0) install deps and create the per-app env files
pnpm install
cp apps/api/.env.example apps/api/.env   # backend env (DB, JWT, passport key)
cp apps/web/.env.example apps/web/.env   # frontend env (API URL)

# 1) generate the Prisma client (required in a pnpm workspace)
pnpm db:generate

# 2) start ONLY the database in Docker
docker compose up -d postgres

# 3) migration + seed against that database
pnpm db:migrate                          # prisma migrate deploy
pnpm db:seed                             # seed users + 3 watches

# 4) run API (:3001) and web (:3000) together
pnpm dev
```

</details>

Run them in separate terminals instead of `pnpm dev` if you prefer:

```bash
pnpm --filter @allchrono/api dev         # API only  -> http://localhost:3001
pnpm --filter @allchrono/web dev         # web only  -> http://localhost:3000
```

Re-seed / reset the database at any time:

```bash
pnpm db:seed                             # re-seed (clears demo tables first)
docker compose down -v && docker compose up -d postgres && pnpm db:migrate && pnpm db:seed  # full reset
```

> `apps/api/.env` uses `DATABASE_URL=…@localhost:5433` (host port 5433 avoids clashing with a
> local Postgres install on 5432). In Mode A that value is overridden
> by `docker-compose.yml` to point at the `postgres` service. The `npm run`/`pnpm` scripts
> that need env (`db:migrate`, `db:seed`, `dev`) load `apps/api/.env` automatically because
> Prisma and NestJS read the `.env` from the API's own folder.

## Run the tests

```bash
pnpm test            # backend unit tests (Jest)
# or
pnpm --filter @allchrono/api test
```

Covered: state-machine transitions (valid & invalid), 7% commission invariant, escrow
idempotency (missing key → 400, replay, 409 on body mismatch), passport hash-chain
verification (valid / tampered payload / tampered link / forged signature), and role/viewer
projection logic.

---

## Seed users

All passwords are `password123`.

| Email                        | Role          |
| ---------------------------- | ------------- |
| `buyer@example.com`          | BUYER         |
| `seller@example.com`         | SELLER        |
| `authenticator@example.com`  | AUTHENTICATOR |
| `admin@example.com`          | ADMIN         |

Seeded watches:

- **RX-100001** — Rolex Submariner, `UNLISTED` (list on marketplace, then run full trade flow).
- **RX-200002** — Omega Speedmaster, active `SHIPPED` trade (demo: mark delivered → release).
- **RX-300003** — Patek Nautilus, `RELEASED` trade with a full `AUTHENTICATED → TRANSFERRED`
  passport (demo passport verification).

---

## API overview

| Method | Path                                   | Role                              |
| ------ | -------------------------------------- | --------------------------------- |
| POST   | `/auth/login`                          | public                            |
| POST   | `/watches`                             | SELLER                            |
| GET    | `/watches?status=&page=&pageSize=`     | public                            |
| GET    | `/watches/:id`                         | public                            |
| GET    | `/watches/mine`                        | SELLER                            |
| POST   | `/trades`                              | BUYER                             |
| POST   | `/trades/:id/submit-for-auth`          | SELLER (owns trade)               |
| POST   | `/trades/:id/authentication-verdict`   | AUTHENTICATOR / ADMIN             |
| POST   | `/trades/:id/fund-escrow`              | BUYER (idempotent, header req'd)  |
| POST   | `/trades/:id/mark-shipped`             | SELLER (owns trade)               |
| POST   | `/trades/:id/mark-delivered`           | ADMIN (simulated shipping webhook)|
| POST   | `/trades/:id/release`                  | BUYER / ADMIN                     |
| POST   | `/trades/:id/dispute`                  | BUYER                             |
| POST   | `/trades/:id/refund`                   | ADMIN                             |
| GET    | `/trades`                              | ADMIN / AUTHENTICATOR             |
| GET    | `/trades/:id`                          | any party (role-based projection) |
| GET    | `/passport/by-serial/:serial`          | public                            |

## Frontend routes

| Route                                | Surface        |
| ------------------------------------ | -------------- |
| `/watches`                           | public catalogue (SSR + SEO + JSON-LD) |
| `/watches/[id]`                      | public detail + passport trust signal |
| `/login`                             | login (quick demo logins) |
| `/checkout/[watchId]`                | buyer — initiate trade |
| `/trades/[id]`                       | buyer — fund / release / dispute |
| `/seller/dashboard`                  | seller — inventory + trades |
| `/seller/watches/new`                | seller — multi-step listing form |
| `/seller/trades/[id]`                | seller — ship / net payout / SLA |
| `/admin/dashboard`                   | admin & authenticator ops queue |
| `/admin/trades/[id]`                 | admin — deliver / release / refund; authenticator verdict |

---

## Three most important design decisions

1. **The Trade is a real aggregate, not a table with a `status` column.** All transitions live
   in `trade.entity.ts` behind a single `transition()` primitive that consults an explicit
   allowed-transition map. Illegal moves throw `InvalidTransitionException` (HTTP 400) *before*
   any DB write. Controllers and application services never hand-roll `if (state === ...)`.

2. **Correctness is enforced at multiple layers.** Invariant #1 (one active trade per watch) is a
   service pre-check *and* a Postgres partial unique index. Escrow funding is idempotent *and*
   wrapped in a single transaction so a duplicate collides on the unique key and rolls back —
   there is no window for a double FUND. Every transition uses `SELECT … FOR UPDATE` + one
   `$transaction` for state + side-effects + history.

3. **The passport is deterministic and independently verifiable.** Canonical JSON (recursive key
   sort) → SHA-256 hash chain → HMAC signature with a static key. `verifyChain` recomputes the
   whole chain on read and returns `verified:false` for any tampered row instead of throwing, so
   the public trust signal degrades gracefully.

## Three things I'd do next with more time

1. **HttpOnly cookie sessions + SSR-authenticated pages.** Today the token lives in
   `localStorage` and authenticated pages are client components. Cookies would let the buyer/seller
   trade pages be Server Components and remove the client fetch flash.
2. **Supertest integration suite against a throwaway Postgres** covering the full happy path and
   the concurrency invariants (two buyers racing the same watch, double-fund under real parallel
   requests) — the current suite is fast unit tests.
3. **Outbox + domain events.** Ledger appends and balance credits would be emitted as events from
   the aggregate and dispatched via a transactional outbox, decoupling passport/escrow side-effects
   from the trade transaction.

## What is stubbed / simulated

- **Escrow & payments** — no gateway; `EscrowTransaction` rows + an internal `User.balance`.
- **KYC** — `User.kycStatus` defaults to `VERIFIED`; no provider.
- **Shipping** — `mark-shipped` / `mark-delivered` are manual; ADMIN plays the "webhook".
- **Blockchain** — a Postgres append-only table with a SHA-256 hash chain and a static HMAC
  signing key. No Ethereum, Solidity, wallets, or testnet.

## Known limitations

- Auth token in `localStorage` (see improvement #1).
- No refresh tokens / logout revocation; JWT expiry only.
- Lazy expiration on read + an hourly cron; not a hard real-time deadline.
- Photos are URLs, not uploads.
- Money is `Decimal(14,2)` in one currency (USD), no FX.

See `docs/adr/` for decision records and `docs/walkthrough.md` for a written walkthrough.
# allchrono
