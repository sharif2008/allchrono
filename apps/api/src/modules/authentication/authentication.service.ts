import { Injectable } from '@nestjs/common';
import { Prisma, Verdict } from '@prisma/client';

/**
 * Creates the immutable AuthenticationReport. The state transition itself
 * (PENDING_AUTH -> AUTH_PASSED | AUTH_FAILED) is driven by the Trade aggregate
 * inside TradeApplicationService so it commits atomically with the report.
 */
@Injectable()
export class AuthenticationService {
  async createReport(
    tx: Prisma.TransactionClient,
    params: {
      tradeId: string;
      authenticatorId: string;
      verdict: Verdict;
      notes?: string;
      photoHashes?: string[];
    },
  ) {
    return tx.authenticationReport.create({
      data: {
        tradeId: params.tradeId,
        authenticatorId: params.authenticatorId,
        verdict: params.verdict,
        notes: params.notes,
        photoHashes: params.photoHashes ?? [],
      },
    });
  }
}
