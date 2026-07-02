import { TradeState } from '@prisma/client';

// Re-export the Prisma enum so the domain layer owns the vocabulary and the
// rest of the app imports it from here.
export { TradeState };

/**
 * The single source of truth for allowed transitions. Mirrors the spec exactly.
 * An empty array means the state is terminal.
 */
export const ALLOWED_TRANSITIONS: Record<TradeState, TradeState[]> = {
  [TradeState.DRAFT]: [TradeState.PENDING_AUTH, TradeState.CANCELLED],
  [TradeState.PENDING_AUTH]: [
    TradeState.AUTH_PASSED,
    TradeState.AUTH_FAILED,
    TradeState.CANCELLED,
  ],
  [TradeState.AUTH_PASSED]: [TradeState.ESCROW_FUNDED, TradeState.EXPIRED],
  [TradeState.AUTH_FAILED]: [],
  [TradeState.ESCROW_FUNDED]: [TradeState.SHIPPED, TradeState.REFUNDED_PRE_SHIP],
  [TradeState.SHIPPED]: [TradeState.DELIVERED, TradeState.LOST_IN_TRANSIT],
  [TradeState.DELIVERED]: [TradeState.RELEASED, TradeState.DISPUTED],
  [TradeState.DISPUTED]: [TradeState.RELEASED, TradeState.REFUNDED_POST_DELIVERY],
  [TradeState.RELEASED]: [],
  [TradeState.REFUNDED_PRE_SHIP]: [],
  [TradeState.REFUNDED_POST_DELIVERY]: [],
  [TradeState.EXPIRED]: [],
  [TradeState.CANCELLED]: [],
  [TradeState.LOST_IN_TRANSIT]: [],
};

export const TERMINAL_STATES: ReadonlySet<TradeState> = new Set<TradeState>([
  TradeState.AUTH_FAILED,
  TradeState.RELEASED,
  TradeState.REFUNDED_PRE_SHIP,
  TradeState.REFUNDED_POST_DELIVERY,
  TradeState.EXPIRED,
  TradeState.CANCELLED,
  TradeState.LOST_IN_TRANSIT,
]);

export function isTerminal(state: TradeState): boolean {
  return TERMINAL_STATES.has(state);
}

export function canTransition(from: TradeState, to: TradeState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
