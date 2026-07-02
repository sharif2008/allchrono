import { ConfigService } from '@nestjs/config';
import { LedgerType } from '@prisma/client';
import { HashChainService, VerifiableEntry } from './hash-chain.service';

function buildService(): HashChainService {
  const config = {
    get: (key: string, def?: string) => def,
  } as unknown as ConfigService;
  return new HashChainService(config);
}

function buildChain(svc: HashChainService): VerifiableEntry[] {
  const e1 = svc.buildNextEntry({
    sequenceNo: 1,
    type: LedgerType.AUTHENTICATED,
    payload: { verdict: 'PASS' },
    prevHash: null,
  });
  const e2 = svc.buildNextEntry({
    sequenceNo: 2,
    type: LedgerType.TRANSFERRED,
    payload: { to: 'buyer-1' },
    prevHash: e1.thisHash,
  });
  return [
    { sequenceNo: 1, type: e1.type, payload: { verdict: 'PASS' }, prevHash: null, thisHash: e1.thisHash, signer: e1.signer, signature: e1.signature },
    { sequenceNo: 2, type: e2.type, payload: { to: 'buyer-1' }, prevHash: e2.prevHash, thisHash: e2.thisHash, signer: e2.signer, signature: e2.signature },
  ];
}

describe('HashChainService', () => {
  const svc = buildService();

  it('verifies an untampered chain', () => {
    expect(svc.verifyChain(buildChain(svc))).toBe(true);
  });

  it('detects a tampered payload (verified=false, no throw)', () => {
    const chain = buildChain(svc);
    (chain[0].payload as Record<string, unknown>).verdict = 'FAIL';
    expect(svc.verifyChain(chain)).toBe(false);
  });

  it('detects a tampered prevHash link', () => {
    const chain = buildChain(svc);
    chain[1].prevHash = 'deadbeef';
    expect(svc.verifyChain(chain)).toBe(false);
  });

  it('detects a forged signature', () => {
    const chain = buildChain(svc);
    chain[1].signature = 'forged';
    expect(svc.verifyChain(chain)).toBe(false);
  });

  it('is deterministic regardless of payload key order', () => {
    const a = svc.computeHash({ sequenceNo: 1, type: LedgerType.AUTHENTICATED, payload: { a: 1, b: 2 }, prevHash: null });
    const b = svc.computeHash({ sequenceNo: 1, type: LedgerType.AUTHENTICATED, payload: { b: 2, a: 1 }, prevHash: null });
    expect(a).toBe(b);
  });
});
