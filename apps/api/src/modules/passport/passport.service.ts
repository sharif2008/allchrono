import { Injectable, NotFoundException } from '@nestjs/common';
import { LedgerType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HashChainService, VerifiableEntry } from './hash-chain.service';

@Injectable()
export class PassportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashChain: HashChainService,
  ) {}

  /**
   * Creates a passport for a watch and links it back. Runs inside the caller's
   * transaction so watch + passport creation is atomic.
   */
  async createForWatch(
    tx: Prisma.TransactionClient,
    watchId: string,
    serialFingerprint: string,
  ): Promise<string> {
    const passport = await tx.passport.create({
      data: { watchId, serialFingerprint },
    });
    await tx.watch.update({
      where: { id: watchId },
      data: { currentPassportId: passport.id },
    });
    return passport.id;
  }

  /**
   * Appends a new ledger entry. Append-only: computes prevHash from the last
   * entry and never mutates prior rows. Must run inside a transaction.
   */
  async appendEntry(
    tx: Prisma.TransactionClient,
    passportId: string,
    type: LedgerType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const last = await tx.ledgerEntry.findFirst({
      where: { passportId },
      orderBy: { sequenceNo: 'desc' },
    });
    const next = this.hashChain.buildNextEntry({
      sequenceNo: (last?.sequenceNo ?? 0) + 1,
      type,
      payload,
      prevHash: last?.thisHash ?? null,
    });
    await tx.ledgerEntry.create({
      data: { passportId, ...next },
    });
  }

  /** Public lookup by serial with full chain verification. */
  async getBySerial(serial: string) {
    const passport = await this.prisma.passport.findUnique({
      where: { serialFingerprint: serial },
      include: { entries: { orderBy: { sequenceNo: 'asc' } } },
    });
    if (!passport) {
      throw new NotFoundException(`No passport found for serial ${serial}`);
    }

    const verifiable: VerifiableEntry[] = passport.entries.map((e) => ({
      sequenceNo: e.sequenceNo,
      type: e.type,
      payload: e.payloadJson,
      prevHash: e.prevHash,
      thisHash: e.thisHash,
      signer: e.signer,
      signature: e.signature,
    }));

    const verified = this.hashChain.verifyChain(verifiable);

    return {
      serial: passport.serialFingerprint,
      verified,
      entries: passport.entries.map((e) => ({
        sequenceNo: e.sequenceNo,
        type: e.type,
        payload: e.payloadJson,
        prevHash: e.prevHash,
        thisHash: e.thisHash,
        signer: e.signer,
        signature: e.signature,
        createdAt: e.createdAt,
      })),
    };
  }
}
