import { Role, TradeState } from '@prisma/client';
import { AuthUser } from '../../../common/decorators/current-user.decorator';

export type TradeNextAction =
  | 'SUBMIT_FOR_AUTH'
  | 'RECORD_VERDICT'
  | 'FUND_ESCROW'
  | 'MARK_SHIPPED'
  | 'MARK_DELIVERED'
  | 'RELEASE'
  | 'DISPUTE'
  | 'REFUND';

export type Viewer = 'BUYER' | 'SELLER' | 'AUTHENTICATOR' | 'ADMIN';

export function resolveViewer(user: AuthUser, trade: { buyerId: string; sellerId: string }): Viewer {
  if (user.id === trade.buyerId) return 'BUYER';
  if (user.id === trade.sellerId) return 'SELLER';
  if (user.roles.includes(Role.ADMIN)) return 'ADMIN';
  if (user.roles.includes(Role.AUTHENTICATOR)) return 'AUTHENTICATOR';
  // Fallback: treat by highest privilege present.
  return 'ADMIN';
}

/** What can THIS viewer legally do next, given the current state. */
export function nextActionsFor(state: TradeState, viewer: Viewer): TradeNextAction[] {
  switch (state) {
    case TradeState.DRAFT:
      return viewer === 'SELLER' ? ['SUBMIT_FOR_AUTH'] : [];
    case TradeState.PENDING_AUTH:
      return viewer === 'AUTHENTICATOR' || viewer === 'ADMIN' ? ['RECORD_VERDICT'] : [];
    case TradeState.AUTH_PASSED:
      return viewer === 'BUYER' ? ['FUND_ESCROW'] : [];
    case TradeState.ESCROW_FUNDED:
      return viewer === 'SELLER' ? ['MARK_SHIPPED'] : [];
    case TradeState.SHIPPED:
      return viewer === 'ADMIN' ? ['MARK_DELIVERED'] : [];
    case TradeState.DELIVERED:
      return viewer === 'BUYER' ? ['RELEASE', 'DISPUTE'] : [];
    case TradeState.DISPUTED:
      if (viewer === 'BUYER') return ['RELEASE'];
      if (viewer === 'ADMIN') return ['RELEASE', 'REFUND'];
      return [];
    default:
      return [];
  }
}
