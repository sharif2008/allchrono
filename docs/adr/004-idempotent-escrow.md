# ADR 004 — Idempotent escrow funding

**Status:** Accepted

Escrow funding must be **exactly-once** under double-clicks and network retries. We require an
`Idempotency-Key` header (the client sends `crypto.randomUUID()`), and the backend persists an
`IdempotencyKey` row: `key` (unique), `endpoint`, `requestHash`, `responseJson`, `statusCode`.
`requestHash = SHA256(canonicalJson(body))`.

Rules:
- **Missing key → 400.**
- **Same key + same `requestHash` → return the stored response** (replay, no side effects).
- **Same key + different `requestHash` → 409 Conflict.**

The critical detail is *atomicity*: `IdempotencyService.run` executes the funding handler **and**
inserts the idempotency row **inside the same `$transaction`**. So a concurrent duplicate either
(a) sees the committed row and replays, or (b) loses the race and violates the unique `key`
constraint (`P2002`), which rolls back its `FUND` `EscrowTransaction` and then replays the
winner's response. There is therefore **no window** in which two `FUND` transactions can be
created for one key. Combined with the aggregate's `fundEscrow()` guard (only valid from
`AUTH_PASSED`, and only before `escrowDueAt`), funding is safe against retries, double-submits, and
stale sessions.
