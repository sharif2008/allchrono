import {
  ConflictException as ConflictErr,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EscrowType,
  LedgerType,
  Prisma,
  Role,
  ShipmentStatus,
  TradeState,
  WatchStatus,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticationService } from '../../authentication/authentication.service';
import { EscrowService } from '../../escrow/escrow.service';
import { IdempotencyService } from '../../escrow/idempotency.service';
import { PassportService } from '../../passport/passport.service';
import { Money, splitCommission } from '../domain/money.vo';
import { TERMINAL_STATES } from '../domain/trade-state.enum';
import { Trade } from '../domain/trade.entity';
import { ITradeRepository, TRADE_REPOSITORY } from '../domain/trade.repository';
import {
  AuthenticationVerdictDto,
  CreateTradeDto,
  DisputeDto,
  MarkShippedDto,
} from '../presentation/dto/trade.dto';
import { nextActionsFor, resolveViewer } from './trade-projection';

const NON_TERMINAL = Array.from(
  Object.values(TradeState).filter((s) => !TERMINAL_STATES.has(s)),
) as TradeState[];

const SHIP_SLA_MS = 3 * 24 * 60 * 60 * 1000; // seller must ship within 72h of funding

@Injectable()
export class TradeApplicationService {
  private readonly escrowDueHours: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRADE_REPOSITORY) private readonly repo: ITradeRepository,
    private readonly escrow: EscrowService,
    private readonly idempotency: IdempotencyService,
    private readonly authentication: AuthenticationService,
    private readonly passport: PassportService,
    config: ConfigService,
  ) {
    this.escrowDueHours = parseInt(config.get<string>('ESCROW_DUE_HOURS', '48'), 10);
  }

  // ---------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------

  async createTrade(user: AuthUser, dto: CreateTradeDto) {
    const watch = await this.prisma.watch.findUnique({ where: { id: dto.watchId } });
    if (!watch) {
      throw new NotFoundException('Watch not found');
    }
    if (watch.sellerId === user.id) {
      throw new ForbiddenException('Sellers cannot buy their own watch');
    }
    if (watch.status !== WatchStatus.LISTED) {
      throw new ConflictErr('This watch is not listed for sale');
    }

    // INVARIANT #1 (service-level pre-check; DB partial index is the backstop).
    const active = await this.prisma.trade.findFirst({
      where: { watchId: watch.id, state: { in: NON_TERMINAL } },
    });
    if (active) {
      throw new ConflictErr('This watch already has an active trade');
    }

    const split = splitCommission(Money.fromDecimal(watch.askingPrice));

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const trade = await tx.trade.create({
          data: {
            watchId: watch.id,
            sellerId: watch.sellerId,
            buyerId: user.id,
            state: TradeState.DRAFT,
            grossAmount: split.gross.toDecimalString(),
            commissionAmount: split.commission.toDecimalString(),
            sellerNetAmount: split.net.toDecimalString(),
          },
        });
        await tx.watch.update({
          where: { id: watch.id },
          data: { status: WatchStatus.IN_TRADE },
        });
        await tx.tradeStateHistory.create({
          data: {
            tradeId: trade.id,
            fromState: null,
            toState: TradeState.DRAFT,
            action: 'createTrade',
            actorId: user.id,
          },
        });
        return trade;
      });
      return this.getTrade(user, created.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictErr('This watch already has an active trade');
      }
      throw err;
    }
  }

  async submitForAuth(user: AuthUser, tradeId: string) {
    await this.mutate(tradeId, async (_tx, trade) => {
      this.assertSeller(trade, user);
      trade.submitForAuth(user.id);
    });
    return this.getTrade(user, tradeId);
  }

  async recordAuthentication(user: AuthUser, tradeId: string, dto: AuthenticationVerdictDto) {
    const now = new Date();
    await this.mutate(tradeId, async (tx, trade) => {
      const report = await this.authentication.createReport(tx, {
        tradeId,
        authenticatorId: user.id,
        verdict: dto.verdict,
        notes: dto.notes,
        photoHashes: dto.photoHashes,
      });
      trade.recordAuthentication(dto.verdict, report.id, now, this.escrowDueHours);

      if (trade.state === TradeState.AUTH_PASSED) {
        const watch = await tx.watch.findUnique({ where: { id: trade.watchId } });
        if (watch?.currentPassportId) {
          await this.passport.appendEntry(tx, watch.currentPassportId, LedgerType.AUTHENTICATED, {
            tradeId,
            verdict: dto.verdict,
            reportId: report.id,
            at: now.toISOString(),
          });
        }
      }
    });
    return this.getTrade(user, tradeId);
  }

  async fundEscrow(user: AuthUser, tradeId: string, idempotencyKey: string | undefined, body: unknown) {
    const now = new Date();
    const result = await this.idempotency.run<{
      tradeId: string;
      state: TradeState;
      fundedAmount: string;
      escrowTransactionId: string;
    }>({
      key: idempotencyKey,
      endpoint: 'POST /trades/:id/fund-escrow',
      tradeId,
      body,
      handler: async (tx) => {
        const trade = await this.repo.findByIdForUpdate(tx, tradeId);
        if (!trade) {
          throw new NotFoundException('Trade not found');
        }
        this.assertBuyer(trade, user);
        await this.escrow.debitBuyer(tx, trade.buyerId, trade.grossAmount);
        trade.fundEscrow(now);
        const escrowTx = await this.escrow.record(tx, {
          tradeId,
          type: EscrowType.FUND,
          amount: trade.grossAmount,
          idempotencyKey,
        });
        await this.repo.persist(tx, trade);
        return {
          statusCode: 200,
          body: {
            tradeId,
            state: trade.state,
            fundedAmount: trade.grossAmount.toFixed(2),
            escrowTransactionId: escrowTx.id,
          },
        };
      },
    });
    return result.body;
  }

  async markShipped(user: AuthUser, tradeId: string, dto: MarkShippedDto) {
    const now = new Date();
    await this.mutate(tradeId, async (tx, trade) => {
      this.assertSeller(trade, user);
      const shipment = await tx.shipmentRecord.upsert({
        where: { tradeId },
        create: {
          tradeId,
          trackingNumber: dto.trackingNumber,
          shippedAt: now,
          status: ShipmentStatus.IN_TRANSIT,
        },
        update: {
          trackingNumber: dto.trackingNumber,
          shippedAt: now,
          status: ShipmentStatus.IN_TRANSIT,
        },
      });
      trade.markShipped(dto.trackingNumber, shipment.id, now);
    });
    return this.getTrade(user, tradeId);
  }

  async markDelivered(user: AuthUser, tradeId: string) {
    const now = new Date();
    await this.mutate(tradeId, async (tx, trade) => {
      // ADMIN or simulated shipping webhook (enforced at controller via roles).
      await tx.shipmentRecord.updateMany({
        where: { tradeId },
        data: { deliveredAt: now, status: ShipmentStatus.DELIVERED },
      });
      trade.markDelivered(now);
    });
    return this.getTrade(user, tradeId);
  }

  async release(user: AuthUser, tradeId: string) {
    const now = new Date();
    await this.mutate(tradeId, async (tx, trade) => {
      this.assertBuyerOrAdmin(trade, user);
      trade.releaseFunds(user.id, now); // -> RELEASED (validates DELIVERED|DISPUTED)

      // INVARIANT #2: seller credited ONLY on RELEASE.
      await this.escrow.record(tx, {
        tradeId,
        type: EscrowType.RELEASE,
        amount: trade.grossAmount,
      });
      await this.escrow.creditSeller(tx, trade.sellerId, trade.sellerNetAmount);

      // Passport TRANSFERRED ledger entry.
      const watch = await tx.watch.findUnique({ where: { id: trade.watchId } });
      if (watch?.currentPassportId) {
        await this.passport.appendEntry(tx, watch.currentPassportId, LedgerType.TRANSFERRED, {
          tradeId,
          from: trade.sellerId,
          to: trade.buyerId,
          grossAmount: trade.grossAmount.toFixed(2),
          at: now.toISOString(),
        });
      }
      await tx.watch.update({
        where: { id: trade.watchId },
        data: { status: WatchStatus.SOLD },
      });
    });
    return this.getTrade(user, tradeId);
  }

  async dispute(user: AuthUser, tradeId: string, dto: DisputeDto) {
    const now = new Date();
    await this.mutate(tradeId, async (_tx, trade) => {
      this.assertBuyer(trade, user);
      trade.dispute(dto.reason, now);
    });
    return this.getTrade(user, tradeId);
  }

  async refund(user: AuthUser, tradeId: string) {
    const now = new Date();
    await this.mutate(tradeId, async (tx, trade) => {
      if (trade.state === TradeState.ESCROW_FUNDED) {
        trade.refundPreShip(now);
      } else if (trade.state === TradeState.DISPUTED) {
        trade.refundPostDelivery(now);
      } else {
        trade.refundPreShip(now); // will throw InvalidTransition from other states
      }
      await this.escrow.record(tx, {
        tradeId,
        type: EscrowType.REFUND,
        amount: trade.grossAmount,
      });
      await this.escrow.creditBuyer(tx, trade.buyerId, trade.grossAmount);
    });
    return this.getTrade(user, tradeId);
  }

  // ---------------------------------------------------------------------
  // Query (role-based projection)
  // ---------------------------------------------------------------------

  /** Operational list for ADMIN / AUTHENTICATOR portals. */
  async listAllForOps() {
    const trades = await this.prisma.trade.findMany({
      orderBy: { createdAt: 'desc' },
      include: { watch: { select: { brand: true, model: true, referenceNumber: true } } },
    });
    return trades.map((t) => ({
      tradeId: t.id,
      state: t.state,
      watch: t.watch,
      grossAmount: t.grossAmount.toString(),
      buyerId: t.buyerId,
      sellerId: t.sellerId,
      createdAt: t.createdAt,
    }));
  }

  /** Buyer's own trades — so they can find "Fund escrow" after authentication. */
  async listForBuyer(user: AuthUser) {
    const trades = await this.prisma.trade.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { watch: { select: { brand: true, model: true, referenceNumber: true } } },
    });
    return trades.map((t) => ({
      tradeId: t.id,
      state: t.state,
      watch: t.watch,
      grossAmount: t.grossAmount.toString(),
      escrowDueAt: t.escrowDueAt,
      nextActions: nextActionsFor(t.state, 'BUYER'),
      createdAt: t.createdAt,
    }));
  }

  async getTrade(user: AuthUser, tradeId: string) {
    let raw = await this.loadFull(tradeId);
    if (!raw) {
      throw new NotFoundException('Trade not found');
    }

    // Lazy expiration on read (spec §8).
    const now = new Date();
    if (raw.state === TradeState.AUTH_PASSED && raw.escrowDueAt && now > raw.escrowDueAt) {
      await this.mutate(tradeId, async (_tx, trade) => {
        trade.expireIfOverdue(now);
      });
      raw = await this.loadFull(tradeId);
    }
    if (!raw) {
      throw new NotFoundException('Trade not found');
    }

    const viewer = resolveViewer(user, raw);
    if (viewer === 'AUTHENTICATOR' && !user.roles.includes(Role.ADMIN)) {
      // Authenticators are not a trade party; allow read-only minimal view.
    }

    const passportHistory = await this.safePassport(raw.watch.serialFingerprint);
    const fundTx = raw.escrowTransactions.find((t) => t.type === EscrowType.FUND);
    const funded = fundTx != null;

    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { balance: true },
    });
    const walletBalance = profile?.balance.toString() ?? '0.00';

    const base = {
      tradeId: raw.id,
      state: raw.state,
      viewer,
      watch: {
        id: raw.watch.id,
        brand: raw.watch.brand,
        model: raw.watch.model,
        referenceNumber: raw.watch.referenceNumber,
        serialFingerprint: raw.watch.serialFingerprint,
        condition: raw.watch.condition,
        listingPhotos: raw.watch.listingPhotos,
      },
      grossAmount: raw.grossAmount.toString(),
      trackingNumber: raw.shipment?.trackingNumber ?? null,
      nextActions: nextActionsFor(raw.state, viewer),
      passportHistory,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };

    if (viewer === 'BUYER') {
      // Buyer projection: NO seller payout instrument, NO commission line.
      return {
        ...base,
        walletBalance,
        fundedAmount: funded ? raw.grossAmount.toString() : null,
        disputeDeadline: raw.disputeDeadline,
        escrowDueAt: raw.escrowDueAt,
      };
    }

    if (viewer === 'SELLER') {
      // Seller projection: NO buyer payment instrument, NO funded amount detail.
      const shipmentSla =
        raw.state === TradeState.ESCROW_FUNDED && fundTx
          ? new Date(fundTx.createdAt.getTime() + SHIP_SLA_MS)
          : null;
      return {
        ...base,
        walletBalance,
        commissionAmount: raw.commissionAmount.toString(),
        sellerNetAmount: raw.sellerNetAmount.toString(),
        shipmentSla,
        authFailedReason:
          raw.state === TradeState.AUTH_FAILED
            ? raw.authReport?.notes ?? raw.authReport?.verdict ?? null
            : null,
      };
    }

    // ADMIN / AUTHENTICATOR combined operational view.
    return {
      ...base,
      buyerId: raw.buyerId,
      sellerId: raw.sellerId,
      commissionAmount: raw.commissionAmount.toString(),
      sellerNetAmount: raw.sellerNetAmount.toString(),
      fundedAmount: funded ? raw.grossAmount.toString() : null,
      disputeDeadline: raw.disputeDeadline,
      escrowDueAt: raw.escrowDueAt,
      authReport: raw.authReport
        ? { verdict: raw.authReport.verdict, notes: raw.authReport.notes }
        : null,
    };
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  /** Locks a trade, applies a domain mutation, and persists it atomically. */
  private async mutate(
    tradeId: string,
    fn: (tx: Prisma.TransactionClient, trade: Trade) => Promise<void>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const trade = await this.repo.findByIdForUpdate(tx, tradeId);
      if (!trade) {
        throw new NotFoundException('Trade not found');
      }
      await fn(tx, trade);
      await this.repo.persist(tx, trade);
    });
  }

  private loadFull(tradeId: string) {
    return this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        watch: true,
        shipment: true,
        authReport: true,
        escrowTransactions: true,
      },
    });
  }

  private async safePassport(serial: string) {
    try {
      return await this.passport.getBySerial(serial);
    } catch {
      return null;
    }
  }

  private assertSeller(trade: Trade, user: AuthUser) {
    if (trade.sellerId !== user.id) {
      throw new ForbiddenException('You are not the seller for this trade');
    }
  }
  private assertBuyer(trade: Trade, user: AuthUser) {
    if (trade.buyerId !== user.id) {
      throw new ForbiddenException('You are not the buyer for this trade');
    }
  }
  private assertBuyerOrAdmin(trade: Trade, user: AuthUser) {
    if (trade.buyerId !== user.id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Only the buyer or an admin can release funds');
    }
  }
}
