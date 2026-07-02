import { BadRequestException, Injectable } from '@nestjs/common';
import { EscrowType, Prisma } from '@prisma/client';

/**
 * Simulated wallet + escrow ledger. No real payment gateway.
 *
 * - Buyer wallet debited on FUND ESCROW (after auth passes).
 * - Seller wallet credited ONLY on RELEASE.
 * - Buyer wallet credited back on REFUND.
 */
@Injectable()
export class EscrowService {
  async record(
    tx: Prisma.TransactionClient,
    params: {
      tradeId: string;
      type: EscrowType;
      amount: number;
      idempotencyKey?: string;
    },
  ) {
    return tx.escrowTransaction.create({
      data: {
        tradeId: params.tradeId,
        type: params.type,
        amount: params.amount,
        idempotencyKey: params.idempotencyKey,
      },
    });
  }

  /** Deduct from buyer's simulated wallet when funding escrow. */
  async debitBuyer(tx: Prisma.TransactionClient, buyerId: string, amount: number) {
    const buyer = await tx.user.findUnique({ where: { id: buyerId } });
    if (!buyer) {
      throw new BadRequestException('Buyer not found');
    }
    const available = parseFloat(buyer.balance.toString());
    if (available < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: $${available.toFixed(2)}, required: $${amount.toFixed(2)}`,
      );
    }
    await tx.user.update({
      where: { id: buyerId },
      data: { balance: { decrement: amount } },
    });
  }

  /** Return escrow to buyer on refund. */
  async creditBuyer(tx: Prisma.TransactionClient, buyerId: string, amount: number) {
    await tx.user.update({
      where: { id: buyerId },
      data: { balance: { increment: amount } },
    });
  }

  /** Seller payout on successful release only. */
  async creditSeller(tx: Prisma.TransactionClient, sellerId: string, amount: number) {
    await tx.user.update({
      where: { id: sellerId },
      data: { balance: { increment: amount } },
    });
  }
}
