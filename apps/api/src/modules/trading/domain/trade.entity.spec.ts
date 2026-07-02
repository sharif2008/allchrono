import { Verdict } from '@prisma/client';
import { Trade, TradeProps } from './trade.entity';
import { InvalidTransitionException } from './invalid-transition.exception';
import { TradeState } from './trade-state.enum';

function makeTrade(state: TradeState, overrides: Partial<TradeProps> = {}): Trade {
  return new Trade({
    id: 'trade-1',
    watchId: 'watch-1',
    sellerId: 'seller-1',
    buyerId: 'buyer-1',
    state,
    grossAmount: 10000,
    commissionAmount: 700,
    sellerNetAmount: 9300,
    ...overrides,
  });
}

describe('Trade aggregate state machine', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('DRAFT -> PENDING_AUTH is valid', () => {
    const trade = makeTrade(TradeState.DRAFT);
    trade.submitForAuth('seller-1');
    expect(trade.state).toBe(TradeState.PENDING_AUTH);
    expect(trade.pendingTransitions).toHaveLength(1);
  });

  it('DRAFT -> ESCROW_FUNDED is invalid', () => {
    const trade = makeTrade(TradeState.DRAFT);
    expect(() => trade.fundEscrow(now)).toThrow(InvalidTransitionException);
  });

  it('PENDING_AUTH + PASS -> AUTH_PASSED and sets escrow deadline', () => {
    const trade = makeTrade(TradeState.PENDING_AUTH);
    trade.recordAuthentication(Verdict.PASS, 'report-1', now, 48);
    expect(trade.state).toBe(TradeState.AUTH_PASSED);
    expect(trade.snapshot.escrowDueAt?.getTime()).toBe(now.getTime() + 48 * 3600 * 1000);
  });

  it('PENDING_AUTH + FAIL -> AUTH_FAILED (terminal)', () => {
    const trade = makeTrade(TradeState.PENDING_AUTH);
    trade.recordAuthentication(Verdict.FAIL, 'report-1', now, 48);
    expect(trade.state).toBe(TradeState.AUTH_FAILED);
    expect(trade.isTerminal()).toBe(true);
  });

  it('AUTH_PASSED -> ESCROW_FUNDED is valid before deadline', () => {
    const trade = makeTrade(TradeState.AUTH_PASSED, {
      escrowDueAt: new Date(now.getTime() + 3600 * 1000),
    });
    trade.fundEscrow(now);
    expect(trade.state).toBe(TradeState.ESCROW_FUNDED);
  });

  it('AUTH_PASSED past deadline cannot fund; lazy-expires to EXPIRED', () => {
    const trade = makeTrade(TradeState.AUTH_PASSED, {
      escrowDueAt: new Date(now.getTime() - 1000),
    });
    expect(() => trade.fundEscrow(now)).toThrow(InvalidTransitionException);
    const trade2 = makeTrade(TradeState.AUTH_PASSED, {
      escrowDueAt: new Date(now.getTime() - 1000),
    });
    expect(trade2.expireIfOverdue(now)).toBe(true);
    expect(trade2.state).toBe(TradeState.EXPIRED);
  });

  it('AUTH_FAILED -> RELEASED is invalid (terminal)', () => {
    const trade = makeTrade(TradeState.AUTH_FAILED);
    expect(() => trade.releaseFunds(null, now)).toThrow(InvalidTransitionException);
  });

  it('DELIVERED -> RELEASED is valid', () => {
    const trade = makeTrade(TradeState.DELIVERED);
    trade.releaseFunds('buyer-1', now);
    expect(trade.state).toBe(TradeState.RELEASED);
    expect(trade.snapshot.releasedAt).toEqual(now);
  });

  it('DELIVERED -> DISPUTED is valid within window', () => {
    const trade = makeTrade(TradeState.DELIVERED, {
      disputeDeadline: new Date(now.getTime() + 3600 * 1000),
    });
    trade.dispute('Wrong reference number', now);
    expect(trade.state).toBe(TradeState.DISPUTED);
  });

  it('dispute after deadline is invalid', () => {
    const trade = makeTrade(TradeState.DELIVERED, {
      disputeDeadline: new Date(now.getTime() - 1000),
    });
    expect(() => trade.dispute('too late', now)).toThrow(InvalidTransitionException);
  });

  it('cannot ship before escrow funded', () => {
    const trade = makeTrade(TradeState.AUTH_PASSED);
    expect(() => trade.markShipped('TRK', 'ship-1', now)).toThrow(InvalidTransitionException);
  });
});
