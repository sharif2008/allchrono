# ADR 002 — Trade lifecycle as a domain state machine

**Status:** Accepted

The trade lifecycle is modelled as an explicit **state machine inside the Trade aggregate**
(`trade.entity.ts`), not as scattered `if (status === …)` checks in controllers or services.
A single `ALLOWED_TRANSITIONS` map declares every legal edge, and one private `transition()`
primitive validates the current state before mutating and records a `TransitionRecord`. Domain
methods (`submitForAuth`, `recordAuthentication`, `fundEscrow`, `markShipped`, `markDelivered`,
`releaseFunds`, `dispute`, `refundPreShip`, `refundPostDelivery`, `expire`, `cancel`) express the
ubiquitous language and throw `InvalidTransitionException` (→ HTTP 400) on illegal moves.

This keeps the rules in one testable, framework-free place and makes every edge case fall out of
the same mechanism: shipping before funding, releasing before delivery, disputing after the
window, or recording a verdict on a terminal trade are all simply "not in the allowed set". The
application service wraps each transition in a `$transaction` with a `SELECT … FOR UPDATE` lock so
the state change, the related record (report / escrow tx / shipment), and the
`trade_state_history` row commit atomically. Because the aggregate owns the vocabulary, adding a
state is a deliberate, reviewable edit in one file rather than a hunt across the codebase.
