#!/usr/bin/env bash
# Mode B — Postgres in Docker, API & web run natively, with migrate + seed.
# One command:  bash scripts/dev.sh   (or: pnpm dev:local)
set -euo pipefail

# Always run from the repo root (this script lives in ./scripts).
cd "$(dirname "$0")/.."

echo "▶ 1/7 Installing dependencies…"
pnpm install

echo "▶ 2/7 Ensuring per-app .env files…"
[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env
[ -f apps/web/.env ] || cp apps/web/.env.example apps/web/.env

echo "▶ 3/7 Generating Prisma client…"
pnpm db:generate

echo "▶ 4/7 Starting Postgres in Docker (waiting for healthy)…"
docker compose up -d --wait postgres

echo "▶ 5/7 Running migrations…"
pnpm db:migrate

echo "▶ 6/7 Seeding demo data (4 users + 3 watches)…"
pnpm db:seed

echo "▶ 7/7 Starting API (:3001) + web (:3000)… (Ctrl+C to stop)"
pnpm dev
