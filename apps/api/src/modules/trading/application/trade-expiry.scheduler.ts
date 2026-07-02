import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TradeState } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Optional safety net alongside lazy expiration: periodically sweep AUTH_PASSED
 * trades whose escrow deadline has passed and move them to EXPIRED.
 */
@Injectable()
export class TradeExpiryScheduler {
  private readonly logger = new Logger(TradeExpiryScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireOverdue(): Promise<void> {
    const now = new Date();
    const overdue = await this.prisma.trade.findMany({
      where: { state: TradeState.AUTH_PASSED, escrowDueAt: { lt: now } },
      select: { id: true, state: true },
    });
    for (const t of overdue) {
      await this.prisma.$transaction(async (tx) => {
        // Conditional update guards against a concurrent funding transition.
        const updated = await tx.trade.updateMany({
          where: { id: t.id, state: TradeState.AUTH_PASSED },
          data: { state: TradeState.EXPIRED },
        });
        if (updated.count > 0) {
          await tx.tradeStateHistory.create({
            data: {
              tradeId: t.id,
              fromState: TradeState.AUTH_PASSED,
              toState: TradeState.EXPIRED,
              action: 'expire',
              metadataJson: { reason: 'cron_sweep' },
            },
          });
        }
      });
    }
    if (overdue.length > 0) {
      this.logger.log(`Expired ${overdue.length} overdue AUTH_PASSED trade(s).`);
    }
  }
}
