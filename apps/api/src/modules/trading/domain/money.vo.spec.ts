import { Money, splitCommission, COMMISSION_RATE } from './money.vo';

describe('Money / commission (INVARIANT #6)', () => {
  it('commission is always 7% of gross', () => {
    expect(COMMISSION_RATE).toBe(0.07);
    const { commission, net } = splitCommission(Money.fromMajor(10000));
    expect(commission.toDecimalString()).toBe('700.00');
    expect(net.toDecimalString()).toBe('9300.00');
  });

  it('rounds to cents and keeps gross = commission + net', () => {
    const gross = Money.fromMajor(15999.99);
    const { commission, net } = splitCommission(gross);
    expect(commission.cents + net.cents).toBe(gross.cents);
  });

  it('parses Prisma Decimal-like values', () => {
    const m = Money.fromDecimal({ toString: () => '42000.00' });
    expect(m.major).toBe(42000);
  });
});
