# ADR 003 — Watch passport as a Postgres append-only hash chain

**Status:** Accepted

The watch "passport" is an **append-only ledger table in PostgreSQL** secured by a **SHA-256 hash
chain** and an HMAC signature, rather than a real blockchain (Ethereum/Solidity/wallets/testnet).
Each `LedgerEntry` stores `sequenceNo`, `type`, `payloadJson`, `prevHash`, `thisHash`, `signer`
and `signature`. `thisHash = SHA256(canonicalJson({ sequenceNo, type, payload, prevHash }))` and
`signature = HMAC-SHA256(thisHash, STATIC_KEY)`. Canonical JSON (recursive key sorting) guarantees
the same logical payload always hashes identically, so verification is deterministic.

This is the right trade-off for the brief: it gives us the property that actually matters — a
**tamper-evident, independently verifiable ownership history** — without the operational weight,
cost, latency, and irrelevance of a live chain for a take-home. On read, `verifyChain` recomputes
the entire chain (linkage + hash + signature) and returns `verified: true|false`; a tampered row
yields `false` and **never throws**, so the public trust signal degrades gracefully. Appends are
enforced application-side (no update/delete paths) and DB-side (`@@unique([passportId,
sequenceNo])`); a correction must be a new entry, never a mutation. The static signing key is
loaded from the environment and is explicitly a simulation of a real signer/KMS. Swapping the
storage/anchoring backend later (e.g. periodically anchoring the head hash on a chain) would not
change the domain model.
