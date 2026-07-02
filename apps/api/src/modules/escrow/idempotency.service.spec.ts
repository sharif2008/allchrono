import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IdempotencyService } from './idempotency.service';

class MockPrisma {
  store = new Map<string, any>();

  idempotencyKey = {
    findUnique: async ({ where: { key } }: any) => this.store.get(key) ?? null,
    create: async ({ data }: any) => {
      this.store.set(data.key, data);
      return data;
    },
  };

  async $transaction(fn: (tx: any) => Promise<any>) {
    return fn(this);
  }
}

describe('IdempotencyService (escrow funding)', () => {
  let prisma: MockPrisma;
  let service: IdempotencyService;

  beforeEach(() => {
    prisma = new MockPrisma();
    service = new IdempotencyService(prisma as unknown as PrismaService);
  });

  const handler = () => async () => ({ statusCode: 200, body: { ok: true, n: 1 } });

  it('missing Idempotency-Key returns 400', async () => {
    await expect(
      service.run({ key: undefined, endpoint: 'e', body: {}, handler: handler() }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('runs the handler once and stores the response', async () => {
    let calls = 0;
    const res = await service.run({
      key: 'k1',
      endpoint: 'e',
      body: { amount: 100 },
      handler: async () => {
        calls += 1;
        return { statusCode: 200, body: { txId: 'tx-1' } };
      },
    });
    expect(calls).toBe(1);
    expect(res.replayed).toBe(false);
    expect(res.body).toEqual({ txId: 'tx-1' });
  });

  it('same key + same body replays the stored response (no second handler run)', async () => {
    let calls = 0;
    const run = () =>
      service.run({
        key: 'k2',
        endpoint: 'e',
        body: { amount: 100 },
        handler: async () => {
          calls += 1;
          return { statusCode: 200, body: { txId: 'tx-2' } };
        },
      });
    await run();
    const second = await run();
    expect(calls).toBe(1);
    expect(second.replayed).toBe(true);
    expect(second.body).toEqual({ txId: 'tx-2' });
  });

  it('same key + different body returns 409', async () => {
    await service.run({ key: 'k3', endpoint: 'e', body: { amount: 100 }, handler: handler() });
    await expect(
      service.run({ key: 'k3', endpoint: 'e', body: { amount: 999 }, handler: handler() }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not store idempotency record when handler throws (e.g. insufficient balance)', async () => {
    await expect(
      service.run({
        key: 'k-fail',
        endpoint: 'POST /trades/:id/fund-escrow',
        body: {},
        handler: async () => {
          throw new BadRequestException(
            'Insufficient wallet balance. Available: $50.00, required: $100.00',
          );
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.store.has('k-fail')).toBe(false);
  });
});
