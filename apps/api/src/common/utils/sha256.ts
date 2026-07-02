import { createHash, createHmac } from 'crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Deterministic "signature" over the ledger entry hash using a static key
 * loaded from the environment. This is a SIMULATED signer — see
 * docs/adr/003-passport-hash-chain-in-postgres.md.
 */
export function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload, 'utf8').digest('hex');
}
