import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LedgerType, Prisma } from '@prisma/client';
import { canonicalJson } from '../../common/utils/canonical-json';
import { sha256, sign } from '../../common/utils/sha256';

export interface HashableEntry {
  sequenceNo: number;
  type: LedgerType;
  payload: unknown;
  prevHash: string | null;
}

export interface VerifiableEntry extends HashableEntry {
  thisHash: string;
  signer: string;
  signature: string;
}

/**
 * Implements the SHA-256 hash chain for the watch passport.
 *
 * thisHash = SHA256(canonicalJson({ sequenceNo, type, payload, prevHash }))
 * signature = HMAC-SHA256(thisHash, STATIC_SIGNING_KEY)
 *
 * See docs/adr/003-passport-hash-chain-in-postgres.md.
 */
@Injectable()
export class HashChainService {
  private readonly signingKey: string;
  readonly signer: string;

  constructor(config: ConfigService) {
    this.signingKey = config.get<string>('PASSPORT_SIGNING_KEY', 'allchrono-static-dev-signing-key');
    this.signer = config.get<string>('PASSPORT_SIGNER', 'allchrono-system');
  }

  computeHash(entry: HashableEntry): string {
    return sha256(
      canonicalJson({
        sequenceNo: entry.sequenceNo,
        type: entry.type,
        payload: entry.payload,
        prevHash: entry.prevHash,
      }),
    );
  }

  computeSignature(thisHash: string): string {
    return sign(thisHash, this.signingKey);
  }

  /** Builds the persistable fields for the next ledger entry. */
  buildNextEntry(params: {
    sequenceNo: number;
    type: LedgerType;
    payload: unknown;
    prevHash: string | null;
  }): {
    sequenceNo: number;
    type: LedgerType;
    payloadJson: Prisma.InputJsonValue;
    prevHash: string | null;
    thisHash: string;
    signer: string;
    signature: string;
  } {
    const thisHash = this.computeHash(params);
    return {
      sequenceNo: params.sequenceNo,
      type: params.type,
      payloadJson: params.payload as Prisma.InputJsonValue,
      prevHash: params.prevHash,
      thisHash,
      signer: this.signer,
      signature: this.computeSignature(thisHash),
    };
  }

  /**
   * Recomputes the whole chain and verifies linkage + hash + signature.
   * NEVER throws — a tampered row simply yields verified=false.
   */
  verifyChain(entries: VerifiableEntry[]): boolean {
    let expectedPrev: string | null = null;
    for (const entry of entries) {
      if (entry.prevHash !== expectedPrev) {
        return false;
      }
      const recomputed = this.computeHash(entry);
      if (recomputed !== entry.thisHash) {
        return false;
      }
      if (this.computeSignature(entry.thisHash) !== entry.signature) {
        return false;
      }
      expectedPrev = entry.thisHash;
    }
    return true;
  }
}
