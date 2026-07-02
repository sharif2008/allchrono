import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { canonicalJson } from '../../common/utils/canonical-json';
import { sha256 } from '../../common/utils/sha256';

export interface IdempotentResult<T> {
  statusCode: number;
  body: T;
  replayed: boolean;
}

/**
 * Idempotency for mutating endpoints (escrow funding in particular).
 *
 * Rules (spec §7):
 *  - Missing Idempotency-Key            -> 400
 *  - Same key + same request body       -> return stored response (replay)
 *  - Same key + different request body  -> 409 Conflict
 *
 * The handler runs INSIDE the same DB transaction that stores the idempotency
 * record, so a duplicate can never create two FUND transactions: the second
 * writer collides on the unique `key` and its side effects roll back.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(params: {
    key: string | undefined;
    endpoint: string;
    tradeId?: string;
    body: unknown;
    handler: (tx: Prisma.TransactionClient) => Promise<{ statusCode: number; body: T }>;
  }): Promise<IdempotentResult<T>> {
    if (!params.key || params.key.trim() === '') {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const requestHash = sha256(canonicalJson(params.body ?? {}));

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key: params.key },
    });
    if (existing) {
      return this.replayOrConflict<T>(existing, requestHash);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await params.handler(tx);
        await tx.idempotencyKey.create({
          data: {
            key: params.key as string,
            endpoint: params.endpoint,
            tradeId: params.tradeId,
            requestHash,
            responseJson: result.body as Prisma.InputJsonValue,
            statusCode: result.statusCode,
          },
        });
        return { statusCode: result.statusCode, body: result.body, replayed: false };
      });
    } catch (err) {
      // Lost the race to a concurrent identical request: replay the winner.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await this.prisma.idempotencyKey.findUnique({
          where: { key: params.key },
        });
        if (winner) {
          return this.replayOrConflict<T>(winner, requestHash);
        }
      }
      throw err;
    }
  }

  private replayOrConflict<T>(
    record: { requestHash: string; responseJson: unknown; statusCode: number },
    requestHash: string,
  ): IdempotentResult<T> {
    if (record.requestHash !== requestHash) {
      throw new ConflictException(
        'Idempotency-Key was already used with a different request body',
      );
    }
    return {
      statusCode: record.statusCode,
      body: record.responseJson as T,
      replayed: true,
    };
  }
}
