import {
  EscrowType,
  LedgerType,
  Prisma,
  PrismaClient,
  Role,
  ShipmentStatus,
  TradeState,
  Verdict,
  WatchStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { canonicalJson } from '../src/common/utils/canonical-json';
import { sha256, sign } from '../src/common/utils/sha256';

const prisma = new PrismaClient();

const SIGNING_KEY = process.env.PASSPORT_SIGNING_KEY ?? 'allchrono-static-dev-signing-key';
const SIGNER = process.env.PASSPORT_SIGNER ?? 'allchrono-system';

/** Simulated wallet starting balance for seeded buyer and seller. */
const SEED_BUYER_WALLET = 1_000;
const SEED_SELLER_WALLET = 1_000;
const SEED_STAFF_WALLET = 1_000;

interface SeedLedgerEntry {
  type: LedgerType;
  payload: Record<string, unknown>;
}

/** Builds a valid hash-chained ledger for a passport (mirrors HashChainService). */
async function seedLedger(passportId: string, entries: SeedLedgerEntry[]) {
  let prevHash: string | null = null;
  let seq = 0;
  for (const entry of entries) {
    seq += 1;
    const thisHash = sha256(
      canonicalJson({ sequenceNo: seq, type: entry.type, payload: entry.payload, prevHash }),
    );
    await prisma.ledgerEntry.create({
      data: {
        passportId,
        sequenceNo: seq,
        type: entry.type,
        payloadJson: entry.payload as Prisma.InputJsonValue,
        prevHash,
        thisHash,
        signer: SIGNER,
        signature: sign(thisHash, SIGNING_KEY),
      },
    });
    prevHash = thisHash;
  }
}

async function createWatchWithPassport(input: {
  sellerId: string;
  brand: string;
  model: string;
  referenceNumber: string;
  serialFingerprint: string;
  askingPrice: number;
  condition: string;
  status: WatchStatus;
  photos: string[];
}) {
  const watch = await prisma.watch.create({
    data: {
      sellerId: input.sellerId,
      brand: input.brand,
      model: input.model,
      referenceNumber: input.referenceNumber,
      serialFingerprint: input.serialFingerprint,
      askingPrice: input.askingPrice,
      condition: input.condition,
      status: input.status,
      listingPhotos: input.photos,
    },
  });
  const passport = await prisma.passport.create({
    data: { watchId: watch.id, serialFingerprint: input.serialFingerprint },
  });
  await prisma.watch.update({
    where: { id: watch.id },
    data: { currentPassportId: passport.id },
  });
  return { watch, passport };
}

async function clean() {
  await prisma.ledgerEntry.deleteMany();
  await prisma.tradeStateHistory.deleteMany();
  await prisma.escrowTransaction.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.shipmentRecord.deleteMany();
  await prisma.authenticationReport.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.watch.deleteMany();
  await prisma.passport.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clean();

  const passwordHash = await bcrypt.hash('password123', 10);

  const seller = await prisma.user.create({
    data: {
      email: 'seller@example.com',
      passwordHash,
      roles: [Role.SELLER],
      balance: SEED_SELLER_WALLET,
    },
  });
  const buyer = await prisma.user.create({
    data: {
      email: 'buyer@example.com',
      passwordHash,
      roles: [Role.BUYER],
      balance: SEED_BUYER_WALLET,
    },
  });
  const authenticator = await prisma.user.create({
    data: {
      email: 'authenticator@example.com',
      passwordHash,
      roles: [Role.AUTHENTICATOR],
      balance: SEED_STAFF_WALLET,
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash,
      roles: [Role.ADMIN],
      balance: SEED_STAFF_WALLET,
    },
  });

  // Seeded watches (marketplace visibility + pipeline demo):
  //   RX-100001 — UNLISTED  (seller lists → buyer starts trade)
  //   RX-200002 — IN_TRADE  (trade at SHIPPED)
  //   RX-300003 — SOLD      (trade RELEASED, passport TRANSFERRED)
  await createWatchWithPassport({
    sellerId: seller.id,
    brand: 'Rolex',
    model: 'Submariner Date',
    referenceNumber: '126610LN',
    serialFingerprint: 'RX-100001',
    askingPrice: 100,
    condition: 'Excellent, box & papers',
    status: WatchStatus.UNLISTED,
    photos: ['https://picsum.photos/seed/rx100001/800/600'],
  });

  // --- Watch B: active SHIPPED trade ------------------------------------
  const now = new Date();
  const { watch: watchB, passport: passportB } = await createWatchWithPassport({
    sellerId: seller.id,
    brand: 'Omega',
    model: 'Speedmaster Professional',
    referenceNumber: '310.30.42.50.01.001',
    serialFingerprint: 'RX-200002',
    askingPrice: 120,
    condition: 'Very good, serviced 2024',
    status: WatchStatus.IN_TRADE,
    photos: ['https://picsum.photos/seed/rx200002/800/600'],
  });

  const grossB = 120;
  const commissionB = +(grossB * 0.07).toFixed(2);
  const netB = +(grossB - commissionB).toFixed(2);

  const tradeB = await prisma.trade.create({
    data: {
      watchId: watchB.id,
      sellerId: seller.id,
      buyerId: buyer.id,
      state: TradeState.SHIPPED,
      grossAmount: grossB,
      commissionAmount: commissionB,
      sellerNetAmount: netB,
      authPassedAt: new Date(now.getTime() - 3 * 3600 * 1000),
      escrowDueAt: new Date(now.getTime() + 45 * 3600 * 1000),
    },
  });
  const reportB = await prisma.authenticationReport.create({
    data: {
      tradeId: tradeB.id,
      authenticatorId: authenticator.id,
      verdict: Verdict.PASS,
      notes: 'Movement, bezel and serial verified against reference database.',
      photoHashes: [sha256('rx200002-dial'), sha256('rx200002-movement')],
    },
  });
  const shipmentB = await prisma.shipmentRecord.create({
    data: {
      tradeId: tradeB.id,
      trackingNumber: 'ALLCHRONO-TRK-200002',
      shippedAt: now,
      status: ShipmentStatus.IN_TRANSIT,
    },
  });
  await prisma.escrowTransaction.create({
    data: { tradeId: tradeB.id, type: EscrowType.FUND, amount: grossB },
  });
  await prisma.trade.update({
    where: { id: tradeB.id },
    data: { authReportId: reportB.id, shipmentId: shipmentB.id },
  });
  for (const [from, to, action] of [
    [null, TradeState.DRAFT, 'createTrade'],
    [TradeState.DRAFT, TradeState.PENDING_AUTH, 'submitForAuth'],
    [TradeState.PENDING_AUTH, TradeState.AUTH_PASSED, 'recordAuthentication'],
    [TradeState.AUTH_PASSED, TradeState.ESCROW_FUNDED, 'fundEscrow'],
    [TradeState.ESCROW_FUNDED, TradeState.SHIPPED, 'markShipped'],
  ] as [TradeState | null, TradeState, string][]) {
    await prisma.tradeStateHistory.create({
      data: { tradeId: tradeB.id, fromState: from, toState: to, action },
    });
  }
  await seedLedger(passportB.id, [
    {
      type: LedgerType.AUTHENTICATED,
      payload: { tradeId: tradeB.id, verdict: 'PASS', reportId: reportB.id },
    },
  ]);

  // --- Watch C: RELEASED trade with full passport -----------------------
  const { watch: watchC, passport: passportC } = await createWatchWithPassport({
    sellerId: seller.id,
    brand: 'Patek Philippe',
    model: 'Nautilus',
    referenceNumber: '5711/1A-010',
    serialFingerprint: 'RX-300003',
    askingPrice: 150,
    condition: 'Mint, full set',
    status: WatchStatus.SOLD,
    photos: ['https://picsum.photos/seed/rx300003/800/600'],
  });

  const grossC = 150;
  const commissionC = +(grossC * 0.07).toFixed(2);
  const netC = +(grossC - commissionC).toFixed(2);
  const deliveredAt = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
  const releasedAt = new Date(now.getTime() - 4 * 24 * 3600 * 1000);

  const tradeC = await prisma.trade.create({
    data: {
      watchId: watchC.id,
      sellerId: seller.id,
      buyerId: buyer.id,
      state: TradeState.RELEASED,
      grossAmount: grossC,
      commissionAmount: commissionC,
      sellerNetAmount: netC,
      authPassedAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000),
      escrowDueAt: new Date(now.getTime() - 8 * 24 * 3600 * 1000),
      disputeDeadline: new Date(deliveredAt.getTime() + 72 * 3600 * 1000),
      releasedAt,
    },
  });
  const reportC = await prisma.authenticationReport.create({
    data: {
      tradeId: tradeC.id,
      authenticatorId: authenticator.id,
      verdict: Verdict.PASS,
      notes: 'Full authentication passed; original bracelet and papers matched.',
      photoHashes: [sha256('rx300003-dial')],
    },
  });
  const shipmentC = await prisma.shipmentRecord.create({
    data: {
      tradeId: tradeC.id,
      trackingNumber: 'ALLCHRONO-TRK-300003',
      shippedAt: new Date(deliveredAt.getTime() - 2 * 24 * 3600 * 1000),
      deliveredAt,
      status: ShipmentStatus.DELIVERED,
    },
  });
  await prisma.escrowTransaction.create({
    data: { tradeId: tradeC.id, type: EscrowType.FUND, amount: grossC },
  });
  await prisma.escrowTransaction.create({
    data: { tradeId: tradeC.id, type: EscrowType.RELEASE, amount: grossC },
  });
  await prisma.trade.update({
    where: { id: tradeC.id },
    data: { authReportId: reportC.id, shipmentId: shipmentC.id },
  });
  // Wallets after seeded escrow: buyer debited on fund; seller paid on release only.
  await prisma.user.update({
    where: { id: buyer.id },
    data: { balance: SEED_BUYER_WALLET - grossB - grossC },
  });
  await prisma.user.update({
    where: { id: seller.id },
    data: { balance: SEED_SELLER_WALLET + netC },
  });
  for (const [from, to, action] of [
    [null, TradeState.DRAFT, 'createTrade'],
    [TradeState.DRAFT, TradeState.PENDING_AUTH, 'submitForAuth'],
    [TradeState.PENDING_AUTH, TradeState.AUTH_PASSED, 'recordAuthentication'],
    [TradeState.AUTH_PASSED, TradeState.ESCROW_FUNDED, 'fundEscrow'],
    [TradeState.ESCROW_FUNDED, TradeState.SHIPPED, 'markShipped'],
    [TradeState.SHIPPED, TradeState.DELIVERED, 'markDelivered'],
    [TradeState.DELIVERED, TradeState.RELEASED, 'releaseFunds'],
  ] as [TradeState | null, TradeState, string][]) {
    await prisma.tradeStateHistory.create({
      data: { tradeId: tradeC.id, fromState: from, toState: to, action },
    });
  }
  await seedLedger(passportC.id, [
    {
      type: LedgerType.AUTHENTICATED,
      payload: { tradeId: tradeC.id, verdict: 'PASS', reportId: reportC.id },
    },
    {
      type: LedgerType.TRANSFERRED,
      payload: {
        tradeId: tradeC.id,
        from: seller.id,
        to: buyer.id,
        grossAmount: grossC.toFixed(2),
      },
    },
  ]);

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
  // eslint-disable-next-line no-console
  console.log({
    users: [seller.email, buyer.email, authenticator.email, admin.email],
    wallets: {
      buyer: SEED_BUYER_WALLET - grossB - grossC,
      seller: SEED_SELLER_WALLET + netC,
    },
    watches: {
      unlisted: { serial: 'RX-100001', status: 'UNLISTED' },
      inTrade: { serial: 'RX-200002', status: 'IN_TRADE', tradeState: 'SHIPPED' },
      sold: { serial: 'RX-300003', status: 'SOLD', tradeState: 'RELEASED' },
    },
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
