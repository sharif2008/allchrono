import { Prisma } from '@prisma/client';
import { Trade } from './trade.entity';

export const TRADE_REPOSITORY = Symbol('TRADE_REPOSITORY');

/**
 * Persistence port for the Trade aggregate. All methods take a Prisma
 * transaction client so state changes and history writes commit atomically.
 */
export interface ITradeRepository {
  /** Loads a trade with a row lock (SELECT ... FOR UPDATE). */
  findByIdForUpdate(tx: Prisma.TransactionClient, id: string): Promise<Trade | null>;

  /** Persists the aggregate's new state and appends its transition history. */
  persist(tx: Prisma.TransactionClient, trade: Trade): Promise<void>;
}
