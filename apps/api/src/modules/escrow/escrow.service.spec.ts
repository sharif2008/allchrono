import { BadRequestException } from '@nestjs/common';
import { EscrowService } from './escrow.service';

describe('EscrowService', () => {
  const service = new EscrowService();

  function mockTx(balance: string) {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'buyer-1', balance }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
  }

  it('debitBuyer succeeds when balance covers the amount', async () => {
    const tx = mockTx('1000.00');
    await expect(service.debitBuyer(tx as never, 'buyer-1', 120)).resolves.toBeUndefined();
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'buyer-1' },
      data: { balance: { decrement: 120 } },
    });
  });

  it('debitBuyer fails when balance is insufficient', async () => {
    const tx = mockTx('50.00');
    await expect(service.debitBuyer(tx as never, 'buyer-1', 120)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.debitBuyer(tx as never, 'buyer-1', 120)).rejects.toThrow(
      /Insufficient wallet balance.*Available: \$50\.00, required: \$120\.00/,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('debitBuyer fails when buyer is missing', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    await expect(service.debitBuyer(tx as never, 'missing', 100)).rejects.toThrow(
      'Buyer not found',
    );
  });
});
