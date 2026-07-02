import { PrismaClient, TradeState, WatchStatus } from '@prisma/client';

const prisma = new PrismaClient();
const API = 'http://localhost:3001';

async function login(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const buyer = await prisma.user.findUnique({ where: { email: 'buyer@example.com' } });
  const seller = await prisma.user.findUnique({ where: { email: 'seller@example.com' } });
  if (!buyer || !seller) throw new Error('Seed users missing');

  const buyerToken = (await login('buyer@example.com')).accessToken;
  const headers = (token, extra = {}) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  });

  // Ephemeral listed watch + trade already at AUTH_PASSED (skip earlier pipeline steps).
  const watch = await prisma.watch.create({
    data: {
      sellerId: seller.id,
      brand: 'Test',
      model: 'Insufficient Fund Check',
      referenceNumber: 'TEST-INSUFFICIENT',
      serialFingerprint: `TEST-${Date.now()}`,
      askingPrice: 100,
      condition: 'Test only',
      status: WatchStatus.IN_TRADE,
      listingPhotos: [],
    },
  });

  const gross = 100;
  const commission = 7;
  const net = 93;
  const now = new Date();

  const trade = await prisma.trade.create({
    data: {
      watchId: watch.id,
      sellerId: seller.id,
      buyerId: buyer.id,
      state: TradeState.AUTH_PASSED,
      grossAmount: gross,
      commissionAmount: commission,
      sellerNetAmount: net,
      authPassedAt: now,
      escrowDueAt: new Date(now.getTime() + 48 * 3600 * 1000),
    },
  });

  const originalBalance = buyer.balance;
  await prisma.user.update({ where: { id: buyer.id }, data: { balance: 50 } });

  const fundRes = await fetch(`${API}/trades/${trade.id}/fund-escrow`, {
    method: 'POST',
    headers: headers(buyerToken, { 'Idempotency-Key': `test-insufficient-${trade.id}` }),
    body: JSON.stringify({}),
  });
  const fundBody = await fundRes.json().catch(() => ({}));

  const tradeAfter = await prisma.trade.findUnique({ where: { id: trade.id } });
  const buyerAfter = await prisma.user.findUnique({ where: { id: buyer.id } });
  const escrowCount = await prisma.escrowTransaction.count({ where: { tradeId: trade.id } });

  const pass =
    fundRes.status === 400 &&
    String(fundBody.message ?? '').includes('Insufficient wallet balance') &&
    tradeAfter?.state === TradeState.AUTH_PASSED &&
    escrowCount === 0 &&
    buyerAfter?.balance.toString() === '50';

  console.log(
    JSON.stringify(
      {
        fundStatus: fundRes.status,
        fundMessage: fundBody.message,
        tradeStateAfter: tradeAfter?.state,
        buyerBalanceAfter: buyerAfter?.balance.toString(),
        escrowTxCount: escrowCount,
        pass,
      },
      null,
      2,
    ),
  );

  // Cleanup test data and restore buyer balance
  await prisma.tradeStateHistory.deleteMany({ where: { tradeId: trade.id } });
  await prisma.idempotencyKey.deleteMany({ where: { tradeId: trade.id } });
  await prisma.trade.delete({ where: { id: trade.id } });
  await prisma.watch.delete({ where: { id: watch.id } });
  await prisma.user.update({ where: { id: buyer.id }, data: { balance: originalBalance } });

  await prisma.$disconnect();
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
