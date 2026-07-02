# ADR 001 — ORM choice: Prisma

**Status:** Accepted

We use **Prisma** as the ORM/data-mapper for PostgreSQL. Prisma gives us a single typed schema
as the source of truth, generated types that flow into the domain mappers, first-class
`$transaction` support for the interactive transactions our state machine needs, and a clean
migration workflow. Its `SELECT … FOR UPDATE` via `$queryRaw` lets us row-lock a trade inside a
transaction so concurrent transitions serialize — exactly what the transactional spine requires.

The one place Prisma cannot express what we need is the **partial unique index** enforcing "at
most one non-terminal trade per watch". We handle that in a hand-written migration
(`CREATE UNIQUE INDEX … WHERE state NOT IN (…terminal…)`), which is a reasonable, well-understood
escape hatch. We considered TypeORM (richer decorator-based entities, native support for partial
indexes) but preferred Prisma's type-safety, migration ergonomics, and simpler mental model for a
reviewer to read. The domain layer is deliberately Prisma-agnostic: the `Trade` aggregate is a
plain class and a mapper converts rows to/from it, so the ORM stays at the edges.
