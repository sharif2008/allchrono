import { Role, TradeState } from '@prisma/client';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { nextActionsFor, resolveViewer } from './trade-projection';

const trade = { buyerId: 'buyer-1', sellerId: 'seller-1' };

function user(id: string, roles: Role[]): AuthUser {
  return { id, email: `${id}@x.com`, roles };
}

describe('trade projection helpers', () => {
  it('resolves the viewer by trade party', () => {
    expect(resolveViewer(user('buyer-1', [Role.BUYER]), trade)).toBe('BUYER');
    expect(resolveViewer(user('seller-1', [Role.SELLER]), trade)).toBe('SELLER');
    expect(resolveViewer(user('x', [Role.ADMIN]), trade)).toBe('ADMIN');
    expect(resolveViewer(user('y', [Role.AUTHENTICATOR]), trade)).toBe('AUTHENTICATOR');
  });

  it('buyer sees FUND_ESCROW at AUTH_PASSED; seller does not', () => {
    expect(nextActionsFor(TradeState.AUTH_PASSED, 'BUYER')).toEqual(['FUND_ESCROW']);
    expect(nextActionsFor(TradeState.AUTH_PASSED, 'SELLER')).toEqual([]);
  });

  it('seller ships at ESCROW_FUNDED; buyer cannot', () => {
    expect(nextActionsFor(TradeState.ESCROW_FUNDED, 'SELLER')).toEqual(['MARK_SHIPPED']);
    expect(nextActionsFor(TradeState.ESCROW_FUNDED, 'BUYER')).toEqual([]);
  });

  it('buyer can release or dispute once delivered', () => {
    expect(nextActionsFor(TradeState.DELIVERED, 'BUYER')).toEqual(['RELEASE', 'DISPUTE']);
  });

  it('terminal states expose no actions', () => {
    expect(nextActionsFor(TradeState.RELEASED, 'BUYER')).toEqual([]);
    expect(nextActionsFor(TradeState.AUTH_FAILED, 'SELLER')).toEqual([]);
  });
});
