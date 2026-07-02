import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { WatchesModule } from './modules/watches/watches.module';
import { TradingModule } from './modules/trading/trading.module';
import { PassportDomainModule } from './modules/passport/passport.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';

@Module({
  imports: [
    // Loads apps/api/.env in local standalone runs. In Docker no .env exists and
    // process.env (set by docker-compose) is used instead.
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    IdentityModule,
    WatchesModule,
    TradingModule,
    PassportDomainModule,
    EscrowModule,
    AuthenticationModule,
  ],
  providers: [
    // Global JWT guard; @Public() routes opt out. 401 when token missing/invalid.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
