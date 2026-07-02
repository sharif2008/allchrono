import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { IdempotencyService } from './idempotency.service';

@Module({
  providers: [EscrowService, IdempotencyService],
  exports: [EscrowService, IdempotencyService],
})
export class EscrowModule {}
