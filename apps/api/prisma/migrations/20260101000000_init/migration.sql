-- AllChrono — consolidated schema migration
-- Single source of truth: enums, tables, indexes, and foreign keys.
-- WatchStatus: UNLISTED | LISTED | IN_TRADE | SOLD (TradeState.DRAFT is trade pipeline only)
-- User balance default: 1000 (simulated wallet)

-- Enums
CREATE TYPE "Role" AS ENUM ('BUYER', 'SELLER', 'AUTHENTICATOR', 'ADMIN');
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "WatchStatus" AS ENUM ('UNLISTED', 'LISTED', 'IN_TRADE', 'SOLD');
CREATE TYPE "TradeState" AS ENUM (
  'DRAFT', 'PENDING_AUTH', 'AUTH_PASSED', 'AUTH_FAILED', 'ESCROW_FUNDED',
  'SHIPPED', 'DELIVERED', 'DISPUTED', 'RELEASED', 'REFUNDED_PRE_SHIP',
  'REFUNDED_POST_DELIVERY', 'EXPIRED', 'CANCELLED', 'LOST_IN_TRANSIT'
);
CREATE TYPE "Verdict" AS ENUM ('PASS', 'FAIL', 'INCONCLUSIVE');
CREATE TYPE "EscrowType" AS ENUM ('FUND', 'RELEASE', 'REFUND');
CREATE TYPE "EscrowStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'IN_TRANSIT', 'DELIVERED', 'LOST');
CREATE TYPE "LedgerType" AS ENUM ('AUTHENTICATED', 'SERVICED', 'TRANSFERRED', 'RE_AUTHENTICATED');

-- users
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "roles" "Role"[],
  "kycStatus" "KycStatus" NOT NULL DEFAULT 'VERIFIED',
  "balance" DECIMAL(14,2) NOT NULL DEFAULT 1000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- watches
CREATE TABLE "watches" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "referenceNumber" TEXT NOT NULL,
  "serialFingerprint" TEXT NOT NULL,
  "askingPrice" DECIMAL(14,2) NOT NULL,
  "condition" TEXT NOT NULL,
  "listingPhotos" TEXT[],
  "status" "WatchStatus" NOT NULL DEFAULT 'UNLISTED',
  "currentPassportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "watches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "watches_serialFingerprint_key" ON "watches"("serialFingerprint");
CREATE UNIQUE INDEX "watches_currentPassportId_key" ON "watches"("currentPassportId");
CREATE INDEX "watches_status_idx" ON "watches"("status");

-- trades
CREATE TABLE "trades" (
  "id" TEXT NOT NULL,
  "watchId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "state" "TradeState" NOT NULL DEFAULT 'DRAFT',
  "grossAmount" DECIMAL(14,2) NOT NULL,
  "commissionAmount" DECIMAL(14,2) NOT NULL,
  "sellerNetAmount" DECIMAL(14,2) NOT NULL,
  "authReportId" TEXT,
  "shipmentId" TEXT,
  "authPassedAt" TIMESTAMP(3),
  "escrowDueAt" TIMESTAMP(3),
  "disputeDeadline" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "trades_watchId_idx" ON "trades"("watchId");
CREATE INDEX "trades_buyerId_idx" ON "trades"("buyerId");
CREATE INDEX "trades_sellerId_idx" ON "trades"("sellerId");

-- INVARIANT #1: at most one non-terminal trade per watch.
-- Partial unique index enforces this at the database level (belt & suspenders
-- alongside the service-level pre-check).
CREATE UNIQUE INDEX "trades_watch_active_unique" ON "trades"("watchId")
  WHERE "state" NOT IN (
    'AUTH_FAILED', 'RELEASED', 'REFUNDED_PRE_SHIP', 'REFUNDED_POST_DELIVERY',
    'EXPIRED', 'CANCELLED', 'LOST_IN_TRANSIT'
  );

-- authentication_reports
CREATE TABLE "authentication_reports" (
  "id" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "authenticatorId" TEXT NOT NULL,
  "verdict" "Verdict" NOT NULL,
  "notes" TEXT,
  "photoHashes" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "authentication_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "authentication_reports_tradeId_key" ON "authentication_reports"("tradeId");

-- escrow_transactions
CREATE TABLE "escrow_transactions" (
  "id" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "type" "EscrowType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "EscrowStatus" NOT NULL DEFAULT 'SUCCESS',
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "escrow_transactions_tradeId_idx" ON "escrow_transactions"("tradeId");

-- idempotency_keys
CREATE TABLE "idempotency_keys" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "tradeId" TEXT,
  "endpoint" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseJson" JSONB NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- shipment_records
CREATE TABLE "shipment_records" (
  "id" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "trackingNumber" TEXT NOT NULL,
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
  CONSTRAINT "shipment_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shipment_records_tradeId_key" ON "shipment_records"("tradeId");

-- trade_state_history
CREATE TABLE "trade_state_history" (
  "id" TEXT NOT NULL,
  "tradeId" TEXT NOT NULL,
  "fromState" "TradeState",
  "toState" "TradeState" NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trade_state_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "trade_state_history_tradeId_idx" ON "trade_state_history"("tradeId");

-- passports
CREATE TABLE "passports" (
  "id" TEXT NOT NULL,
  "watchId" TEXT NOT NULL,
  "serialFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "passports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "passports_watchId_key" ON "passports"("watchId");
CREATE UNIQUE INDEX "passports_serialFingerprint_key" ON "passports"("serialFingerprint");

-- ledger_entries (append-only)
CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "passportId" TEXT NOT NULL,
  "sequenceNo" INTEGER NOT NULL,
  "type" "LedgerType" NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "prevHash" TEXT,
  "thisHash" TEXT NOT NULL,
  "signer" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ledger_entries_passportId_sequenceNo_key" ON "ledger_entries"("passportId", "sequenceNo");
CREATE INDEX "ledger_entries_passportId_idx" ON "ledger_entries"("passportId");

-- Foreign keys
ALTER TABLE "watches" ADD CONSTRAINT "watches_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "watches" ADD CONSTRAINT "watches_currentPassportId_fkey" FOREIGN KEY ("currentPassportId") REFERENCES "passports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trades" ADD CONSTRAINT "trades_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "watches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trades" ADD CONSTRAINT "trades_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authentication_reports" ADD CONSTRAINT "authentication_reports_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authentication_reports" ADD CONSTRAINT "authentication_reports_authenticatorId_fkey" FOREIGN KEY ("authenticatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipment_records" ADD CONSTRAINT "shipment_records_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trade_state_history" ADD CONSTRAINT "trade_state_history_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "passports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
