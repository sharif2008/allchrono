import { Trade as TradeRow } from '@prisma/client';
import { Trade, TradeProps } from '../domain/trade.entity';

function toNumber(value: { toString(): string }): number {
  return parseFloat(value.toString());
}

/** Maps a Prisma trade row into the pure-domain Trade aggregate. */
export function toDomain(row: TradeRow): Trade {
  const props: TradeProps = {
    id: row.id,
    watchId: row.watchId,
    sellerId: row.sellerId,
    buyerId: row.buyerId,
    state: row.state,
    grossAmount: toNumber(row.grossAmount),
    commissionAmount: toNumber(row.commissionAmount),
    sellerNetAmount: toNumber(row.sellerNetAmount),
    authReportId: row.authReportId,
    shipmentId: row.shipmentId,
    authPassedAt: row.authPassedAt,
    escrowDueAt: row.escrowDueAt,
    disputeDeadline: row.disputeDeadline,
    releasedAt: row.releasedAt,
    cancelledAt: row.cancelledAt,
  };
  return new Trade(props);
}
