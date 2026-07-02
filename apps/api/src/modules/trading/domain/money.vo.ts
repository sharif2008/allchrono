/**
 * Money value object stored as integer minor units (cents) to avoid floating
 * point drift. Commission is a flat 7% of gross (INVARIANT #6).
 */
export const COMMISSION_RATE = 0.07;

export class Money {
  private constructor(public readonly cents: number) {}

  static fromMajor(amount: number): Money {
    return new Money(Math.round(amount * 100));
  }

  static fromDecimal(value: { toString(): string }): Money {
    return Money.fromMajor(parseFloat(value.toString()));
  }

  get major(): number {
    return this.cents / 100;
  }

  multiplyRate(rate: number): Money {
    return new Money(Math.round(this.cents * rate));
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  toDecimalString(): string {
    return (this.cents / 100).toFixed(2);
  }
}

export interface CommissionSplit {
  gross: Money;
  commission: Money;
  net: Money;
}

/** commissionAmount = gross * 0.07 ; sellerNet = gross - commission. */
export function splitCommission(gross: Money): CommissionSplit {
  const commission = gross.multiplyRate(COMMISSION_RATE);
  const net = gross.subtract(commission);
  return { gross, commission, net };
}
