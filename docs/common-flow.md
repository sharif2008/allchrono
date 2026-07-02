# Common Flow — The Verified Trade Pipeline

AllChrono is built around one idea: **a luxury watch moves from listing → authentication → escrow → shipping → release**, with a **Trade** as the central record and an immutable **passport ledger** as the trust signal.

---

## Actors

| Role | What they do |
|------|----------------|
| **Seller** | Lists watches, submits for auth, ships after escrow |
| **Buyer** | Browses catalogue, starts trade, funds escrow, releases or disputes |
| **Authenticator / Admin** | Records PASS / FAIL / INCONCLUSIVE |
| **Admin** | Simulates shipping webhook (`mark-delivered`), can refund / release |
| **Public** | Browses listings, sees passport verified badge only (no trade pipeline) |

---

## Happy path (step by step)

```
1. Seller creates a watch listing
   POST /watches { ..., listed: true|false }  →  watch LISTED or UNLISTED + Passport created

2. Buyer starts a trade (LISTED watches only — no charge yet)
   POST /trades { watchId }  →  Trade state: DRAFT
   buyerId = logged-in buyer, sellerId = watch owner

3. Seller submits for authentication
   POST /trades/:id/submit-for-auth  →  PENDING_AUTH

4. Authenticator records verdict
   POST /trades/:id/authentication-verdict { verdict: PASS }
   →  AUTH_PASSED
   →  escrowDueAt = now + 48h
   →  Passport ledger: AUTHENTICATED entry appended

5. Buyer funds escrow (idempotent) — **wallet debited here**
   POST /trades/:id/fund-escrow  (+ Idempotency-Key header)
   →  ESCROW_FUNDED
   →  EscrowTransaction FUND recorded
   →  Seller is NOT paid yet
   →  **Fails with 400 if buyer wallet balance < gross amount** (trade stays `AUTH_PASSED`, no FUND record)

6. Seller ships
   POST /trades/:id/mark-shipped { trackingNumber }
   →  SHIPPED

7. Admin / shipping webhook marks delivered
   POST /trades/:id/mark-delivered
   →  DELIVERED
   →  disputeDeadline = now + 72h

8. Buyer releases funds
   POST /trades/:id/release
   →  RELEASED
   →  EscrowTransaction RELEASE
   →  Seller credited net amount (gross − 7% commission)
   →  Passport ledger: TRANSFERRED entry (from seller → buyer)
   →  Watch status: SOLD
```

---

## State machine (simplified)

```
DRAFT → PENDING_AUTH → AUTH_PASSED → ESCROW_FUNDED → SHIPPED → DELIVERED → RELEASED
              ↓              ↓              ↓
         AUTH_FAILED      EXPIRED    REFUNDED_PRE_SHIP
                                              ↓
                                         DISPUTED → RELEASED or REFUNDED_POST_DELIVERY
```

Terminal states (`AUTH_FAILED`, `RELEASED`, `EXPIRED`, refunds, etc.) have no further actions.

See also: [ADR 002 — Trade state machine](./adr/002-trade-state-machine.md).

---

## What happens at each layer

### Trade (aggregate)

All lifecycle rules live in `apps/api/src/modules/trading/domain/trade.entity.ts`. Illegal transitions throw before any DB write.

### Escrow (simulated)

- **FUND** on escrow funding — money held, seller not credited
- **RELEASE** on release — seller gets `sellerNetAmount`
- **REFUND** on admin refund paths

Funding is **idempotent** (same `Idempotency-Key` + body = same response, no double charge).

See also: [ADR 004 — Idempotent escrow](./adr/004-idempotent-escrow.md).

### Passport (hash chain)

Append-only ledger per watch serial:

- Watch listed → Passport created
- Auth PASS → `AUTHENTICATED`
- Release → `TRANSFERRED` (real `from` / `to` user UUIDs)

Public: `GET /passport/by-serial/:serial` → `verified: true/false`

See also: [ADR 003 — Passport hash chain](./adr/003-passport-hash-chain-in-postgres.md).

### Projections

`GET /trades/:id` returns different fields per role:

- **Buyer** sees funded amount, escrow deadline, dispute window
- **Seller** sees commission, net payout, ship SLA

Neither sees the other party's payment/payout instruments.

---

## Typical user journeys (UI)

| Surface | Flow |
|---------|------|
| **Public** | `/watches` → `/watches/[id]` (passport as trust signal) |
| **Buyer** | Login → Buy → `/checkout/[watchId]` → `/trades/[id]` (fund → wait → release) |
| **Seller** | `/seller/dashboard` → submit auth → mark shipped → see net payout |
| **Admin / Authenticator** | `/admin/dashboard` → verdict → mark delivered → refund if needed |

---

## Seeded demo shortcuts

After seed, you can demo without clicking through setup:

| Watch | State | Demo |
|-------|-------|------|
| **RX-100001** | UNLISTED | Full happy path — list, then buyer starts trade |
| **RX-200002** | SHIPPED | Mark delivered → release |
| **RX-300003** | RELEASED | Passport verification (`verified: true`) |

Logins: `buyer@`, `seller@`, `authenticator@`, `admin@example.com` — all `password123`.

---

## One-line summary

**Seller lists → buyer buys → auth passes → buyer funds escrow → seller ships → delivery confirmed → buyer releases → seller paid (minus 7%) → passport records the transfer.**
