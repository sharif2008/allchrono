import { Module } from '@nestjs/common';
import { PassportController } from './passport.controller';
import { PassportService } from './passport.service';
import { HashChainService } from './hash-chain.service';

@Module({
  controllers: [PassportController],
  providers: [PassportService, HashChainService],
  exports: [PassportService, HashChainService],
})
export class PassportDomainModule {}
