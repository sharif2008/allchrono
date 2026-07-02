import { Module } from '@nestjs/common';
import { PassportDomainModule } from '../passport/passport.module';
import { WatchesService } from './application/watches.service';
import { WatchesController } from './presentation/watches.controller';

@Module({
  imports: [PassportDomainModule],
  controllers: [WatchesController],
  providers: [WatchesService],
  exports: [WatchesService],
})
export class WatchesModule {}
