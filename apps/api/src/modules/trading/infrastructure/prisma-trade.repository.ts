import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Trade } from '../domain/trade.entity';
import { ITradeRepository } from '../domain/trade.repository';
import { toDomain } from './trade.mapper';

@Injectable()
export class PrismaTradeRepository implements ITradeRepository {
  async findByIdForUpdate(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<Trade | null> {
    // Row-level lock so concurrent transitions on the same trade serialize.
    // (See docs/adr/002-trade-state-machine.md.)
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM "trades" WHERE id = ${id} FOR UPDATE`,
    );
    if (locked.length === 0) {
      return null;
    }
    const row = await tx.trade.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async persist(tx: Prisma.TransactionClient, trade: Trade): Promise<void> {
    const s = trade.snapshot;
    await tx.trade.update({
      where: { id: s.id },
      data: {
        state: s.state,
        authReportId: s.authReportId ?? undefined,
        shipmentId: s.shipmentId ?? undefined,
        authPassedAt: s.authPassedAt ?? undefined,
        escrowDueAt: s.escrowDueAt ?? undefined,
        disputeDeadline: s.disputeDeadline ?? undefined,
        releasedAt: s.releasedAt ?? undefined,
        cancelledAt: s.cancelledAt ?? undefined,
      },
    });

    for (const t of trade.pendingTransitions) {
      await tx.tradeStateHistory.create({
        data: {
          tradeId: s.id,
          fromState: t.fromState,
          toState: t.toState,
          action: t.action,
          actorId: t.actorId ?? null,
          metadataJson: (t.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }
  }
}
