# AllChrono — Written Walkthrough (~5 min read)

This is the written stand-in for a short Loom. It covers the three things worth your attention:
the state machine, the idempotency design, and one thing I'd change.

## 1. The state machine

The `Trade` is the aggregate and the transactional spine. Open
`apps/api/src/modules/trading/domain/trade.entity.ts`.

- There is exactly one way state changes: the private `transition(to, action, actor, metadata)`
  method. It looks up `ALLOWED_TRANSITIONS[from]`; if `to` isn't in the set it throws
  `InvalidTransitionException` (HTTP 400) and nothing is written.
- The public domain methods are the ubiquitous language: `submitForAuth`, `recordAuthentication`
  (PASS → `AUTH_PASSED` and stamps `escrowDueAt = now + 48h`; FAIL/INCONCLUSIVE → terminal
  `AUTH_FAILED`), `fundEscrow`, `markShipped`, `markDelivered` (stamps the 72h dispute window),
  `releaseFunds`, `dispute`, `refundPreShip`, `refundPostDelivery`, `expire`, `cancel`.
- The application service (`trade-application.service.ts`) is the only place that touches the DB.
  Each command runs in one `prisma.$transaction`, takes a `SELECT … FOR UPDATE` row lock via the
  repository, rebuilds the aggregate from the row, calls the domain method, writes the related
  record (report / escrow tx / shipment / ledger), persists the new state, and appends
  `trade_state_history`. State + side-effects + audit commit together or not at all.
- **Hard invariants show up as code you can point to:** the seller is credited *only* in the
  RELEASE path (`escrow.creditSeller` is called nowhere else — invariant #2); commission is a flat
  7% computed once in `money.vo.ts` (#6); one active trade per watch is a service pre-check plus a
  Postgres partial unique index (#1); the passport ledger has no update/delete code path (#3);
  and `GET /trades/:id` returns a **different projection per viewer** so a buyer never sees the
  seller's commission/net and vice-versa (#4).

The **AUTH_PASSED-but-buyer-doesn't-pay** case is handled by lazy expiration: `fundEscrow()`
refuses once `now > escrowDueAt`, and `GET /trades/:id` expires an overdue trade on read (plus an
hourly cron sweep as a backstop). When the buyer returns before the deadline, the projection's
`nextActions` is `["FUND_ESCROW"]` and the UI shows "fund escrow before deadline".

## 2. Idempotency design

See `apps/api/src/modules/escrow/idempotency.service.ts` and ADR 004.

The frontend generates `crypto.randomUUID()` per fund attempt (kept stable across retries in a
ref) and sends it as `Idempotency-Key`. The backend hashes the canonical JSON body and:

- missing key → **400**;
- key seen with the **same** body hash → returns the **stored** response (replay);
- key seen with a **different** body hash → **409**.

The clever bit is that the funding side-effect and the idempotency row are written in the **same
transaction**. A double-click that races itself will either replay the committed winner or trip
the unique-key constraint and roll back its own `FUND` — so the invariant "at most one FUND per
key" holds even under true concurrency, not just sequential retries. Unit tests cover all four
outcomes.

## 3. Passport hash chain

`hash-chain.service.ts`: canonical JSON (recursive key sort) → `thisHash = SHA256(...)` →
`signature = HMAC(thisHash, staticKey)`, with each entry linking `prevHash → thisHash`.
`verifyChain` recomputes linkage, hash, and signature for the whole chain on read and returns
`verified:false` for any tampered row **without throwing**. The public page renders a clear
green/red trust banner. Entries are appended on authentication PASS (`AUTHENTICATED`) and on
release (`TRANSFERRED`).

## 4. One thing I'm not proud of / would change

**Auth is client-side (`localStorage` + client components for authenticated pages).** It was the
fastest way to keep the public catalogue as clean SEO-friendly Server Components while still
demoing role-gated actions, but it means the buyer/seller/admin trade pages fetch on the client
and briefly flash a loading state, and the token isn't HttpOnly. With more time I'd move to
HttpOnly cookie sessions and make those pages Server Components, which also tightens security.

## What was cut for time

- A Supertest integration suite against a real (throwaway) Postgres for the full happy path and
  concurrency invariants — current tests are fast unit tests of the domain and services.
- File uploads for photos (URLs only), refresh tokens, and multi-currency/FX.
- Richer seller SLA/analytics and email/notification stubs.
