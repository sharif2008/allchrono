# Mode B (Windows) - Postgres in Docker, API & web run natively, with migrate + seed.
# Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
$ErrorActionPreference = "Stop"

# Always run from the repo root (this script lives in .\scripts).
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "1/7 Installing dependencies..." -ForegroundColor Cyan
pnpm install

Write-Host "2/7 Ensuring per-app .env files..." -ForegroundColor Cyan
if (-not (Test-Path "apps\api\.env")) { Copy-Item "apps\api\.env.example" "apps\api\.env" }
if (-not (Test-Path "apps\web\.env")) { Copy-Item "apps\web\.env.example" "apps\web\.env" }

Write-Host "3/7 Generating Prisma client..." -ForegroundColor Cyan
pnpm db:generate

Write-Host "4/7 Starting Postgres in Docker (waiting for healthy)..." -ForegroundColor Cyan
docker compose up -d --wait postgres

Write-Host "5/7 Running migrations..." -ForegroundColor Cyan
pnpm db:migrate

Write-Host "6/7 Seeding demo data (4 users + 3 watches)..." -ForegroundColor Cyan
pnpm db:seed

Write-Host "7/7 Starting API (:3001) + web (:3000)... (Ctrl+C to stop)" -ForegroundColor Green
pnpm dev
