import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { EscrowModule } from '../escrow/escrow.module';
import { PassportDomainModule } from '../passport/passport.module';
import { TradeApplicationService } from './application/trade-application.service';
import { TradeExpiryScheduler } from './application/trade-expiry.scheduler';
import { TRADE_REPOSITORY } from './domain/trade.repository';
import { PrismaTradeRepository } from './infrastructure/prisma-trade.repository';
import { TradesController } from './presentation/trades.controller';

@Module({
  imports: [AuthenticationModule, EscrowModule, PassportDomainModule],
  controllers: [TradesController],
  providers: [
    TradeApplicationService,
    TradeExpiryScheduler,
    { provide: TRADE_REPOSITORY, useClass: PrismaTradeRepository },
  ],
  exports: [TradeApplicationService],
})
export class TradingModule {}
