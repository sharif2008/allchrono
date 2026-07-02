import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../../../common/decorators/current-user.decorator';
import { TradeApplicationService } from '../application/trade-application.service';
import {
  AuthenticationVerdictDto,
  CreateTradeDto,
  DisputeDto,
  FundEscrowDto,
  MarkShippedDto,
} from './dto/trade.dto';

/**
 * Thin controller: no business logic. Coarse role checks via @Roles/RolesGuard;
 * ownership and all lifecycle rules live in TradeApplicationService / the Trade
 * aggregate.
 */
@Controller('trades')
@UseGuards(RolesGuard)
export class TradesController {
  constructor(private readonly trades: TradeApplicationService) {}

  @Post()
  @Roles(Role.BUYER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTradeDto) {
    return this.trades.createTrade(user, dto);
  }

  @Post(':id/submit-for-auth')
  @Roles(Role.SELLER)
  submitForAuth(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trades.submitForAuth(user, id);
  }

  @Post(':id/authentication-verdict')
  @Roles(Role.AUTHENTICATOR, Role.ADMIN)
  verdict(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AuthenticationVerdictDto,
  ) {
    return this.trades.recordAuthentication(user, id, dto);
  }

  @Post(':id/fund-escrow')
  @Roles(Role.BUYER)
  fundEscrow(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: FundEscrowDto,
  ) {
    return this.trades.fundEscrow(user, id, idempotencyKey, dto ?? {});
  }

  @Post(':id/mark-shipped')
  @Roles(Role.SELLER)
  markShipped(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MarkShippedDto,
  ) {
    return this.trades.markShipped(user, id, dto);
  }

  // ADMIN acts as the simulated shipping webhook.
  @Post(':id/mark-delivered')
  @Roles(Role.ADMIN)
  markDelivered(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trades.markDelivered(user, id);
  }

  @Post(':id/release')
  @Roles(Role.BUYER, Role.ADMIN)
  release(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trades.release(user, id);
  }

  @Post(':id/dispute')
  @Roles(Role.BUYER)
  dispute(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DisputeDto,
  ) {
    return this.trades.dispute(user, id, dto);
  }

  @Post(':id/refund')
  @Roles(Role.ADMIN)
  refund(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trades.refund(user, id);
  }

  // Buyer's trades (declared before :id).
  @Get('mine')
  @Roles(Role.BUYER)
  listMine(@CurrentUser() user: AuthUser) {
    return this.trades.listForBuyer(user);
  }

  // Ops list for admin/authenticator portals.
  @Get()
  @Roles(Role.ADMIN, Role.AUTHENTICATOR)
  listAll() {
    return this.trades.listAllForOps();
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trades.getTrade(user, id);
  }
}
