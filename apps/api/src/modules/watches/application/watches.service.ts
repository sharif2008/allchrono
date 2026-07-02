import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

import { TradeState, WatchStatus } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';

import { PassportService } from '../../passport/passport.service';

import { TERMINAL_STATES } from '../../trading/domain/trade-state.enum';

import { canEditWatch } from '../domain/watch.entity';

import { CreateWatchDto } from '../presentation/dto/create-watch.dto';

import { UpdateWatchDto } from '../presentation/dto/update-watch.dto';



@Injectable()

export class WatchesService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly passportService: PassportService,

  ) {}



  /**

   * Create a listing. A Passport is created and linked in the same transaction

   * (spec §9: "Watch created/listed: create Passport").

   */

  async createListing(sellerId: string, dto: CreateWatchDto) {

    const listed = dto.listed !== false;

    return this.prisma.$transaction(async (tx) => {

      const watch = await tx.watch.create({

        data: {

          sellerId,

          brand: dto.brand,

          model: dto.model,

          referenceNumber: dto.referenceNumber,

          serialFingerprint: dto.serialFingerprint,

          askingPrice: dto.askingPrice,

          condition: dto.condition,

          listingPhotos: dto.listingPhotos ?? [],

          status: listed ? WatchStatus.LISTED : WatchStatus.UNLISTED,

        },

      });

      await this.passportService.createForWatch(tx, watch.id, watch.serialFingerprint);

      return tx.watch.findUnique({ where: { id: watch.id } });

    });

  }



  /** Show a watch on the public marketplace. */

  async listOnMarketplace(sellerId: string, watchId: string) {

    return this.setListingVisibility(sellerId, watchId, true);

  }



  /** Hide a watch from the public marketplace. */

  async unlistFromMarketplace(sellerId: string, watchId: string) {

    return this.setListingVisibility(sellerId, watchId, false);

  }



  private async setListingVisibility(sellerId: string, watchId: string, listed: boolean) {

    const watch = await this.prisma.watch.findUnique({ where: { id: watchId } });

    if (!watch) {

      throw new NotFoundException('Watch not found');

    }

    if (watch.sellerId !== sellerId) {

      throw new ForbiddenException('You can only manage your own listings');

    }



    const activeTrade = await this.prisma.trade.findFirst({

      where: {

        watchId,

        state: { notIn: Array.from(TERMINAL_STATES) as TradeState[] },

      },

    });

    if (activeTrade) {

      throw new BadRequestException('Cannot change listing visibility during an active trade');

    }



    const target = listed ? WatchStatus.LISTED : WatchStatus.UNLISTED;

    if (watch.status === WatchStatus.IN_TRADE || watch.status === WatchStatus.SOLD) {

      throw new BadRequestException('This watch cannot be listed or unlisted in its current state');

    }

    if (watch.status === target) {

      return watch;

    }



    return this.prisma.watch.update({

      where: { id: watchId },

      data: { status: target },

    });

  }



  /** Update a listing owned by the seller (LISTED/UNLISTED only, no active trade). */

  async updateListing(sellerId: string, watchId: string, dto: UpdateWatchDto) {

    const watch = await this.prisma.watch.findUnique({ where: { id: watchId } });

    if (!watch) {

      throw new NotFoundException('Watch not found');

    }

    if (watch.sellerId !== sellerId) {

      throw new ForbiddenException('You can only edit your own listings');

    }



    const activeTrade = await this.prisma.trade.findFirst({

      where: {

        watchId,

        state: { notIn: Array.from(TERMINAL_STATES) as TradeState[] },

      },

    });

    if (!canEditWatch(watch.status, !!activeTrade)) {

      throw new BadRequestException('This listing cannot be edited while a trade is in progress');

    }



    const { listed, ...fields } = dto;

    const updated = await this.prisma.watch.update({

      where: { id: watchId },

      data: {

        ...(fields.brand !== undefined && { brand: fields.brand }),

        ...(fields.model !== undefined && { model: fields.model }),

        ...(fields.referenceNumber !== undefined && { referenceNumber: fields.referenceNumber }),

        ...(fields.askingPrice !== undefined && { askingPrice: fields.askingPrice }),

        ...(fields.condition !== undefined && { condition: fields.condition }),

        ...(fields.listingPhotos !== undefined && { listingPhotos: fields.listingPhotos }),

      },

    });



    if (listed !== undefined) {

      return this.setListingVisibility(sellerId, watchId, listed);

    }

    return updated;

  }



  async listCatalogue(params: { status?: WatchStatus; page: number; pageSize: number }) {

    const where = params.status ? { status: params.status } : {};

    const [items, total] = await Promise.all([

      this.prisma.watch.findMany({

        where,

        orderBy: { createdAt: 'desc' },

        skip: (params.page - 1) * params.pageSize,

        take: params.pageSize,

        include: { seller: { select: { id: true, email: true } } },

      }),

      this.prisma.watch.count({ where }),

    ]);

    return {

      items: items.map((w) => this.toPublicCard(w)),

      total,

      page: params.page,

      pageSize: params.pageSize,

      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),

    };

  }



  /** Public detail including verified passport history (buyer trust signal). */

  async getPublicDetail(id: string) {

    const watch = await this.prisma.watch.findUnique({

      where: { id },

      include: { seller: { select: { id: true, email: true } } },

    });

    if (!watch) {

      throw new NotFoundException('Watch not found');

    }



    let passport = null;

    try {

      passport = await this.passportService.getBySerial(watch.serialFingerprint);

    } catch {

      passport = null;

    }



    const activeTrade = await this.prisma.trade.findFirst({

      where: {

        watchId: watch.id,

        state: { notIn: Array.from(TERMINAL_STATES) as TradeState[] },

      },

      orderBy: { createdAt: 'desc' },

    });



    return {

      id: watch.id,

      brand: watch.brand,

      model: watch.model,

      referenceNumber: watch.referenceNumber,

      serialFingerprint: watch.serialFingerprint,

      askingPrice: watch.askingPrice.toString(),

      condition: watch.condition,

      listingPhotos: watch.listingPhotos,

      status: watch.status,

      sellerId: watch.seller.id,

      sellerEmail: watch.seller.email,

      activeTradeId: activeTrade?.id ?? null,

      activeTradeState: activeTrade?.state ?? null,

      passport,

    };

  }



  async listForSeller(sellerId: string) {

    const watches = await this.prisma.watch.findMany({

      where: { sellerId },

      orderBy: { createdAt: 'desc' },

      include: { trades: { orderBy: { createdAt: 'desc' }, take: 1 } },

    });

    return watches.map((w) => ({

      ...this.toPublicCard(w),

      activeTradeId: w.trades[0]?.id ?? null,

      activeTradeState: w.trades[0]?.state ?? null,

    }));

  }



  private toPublicCard(w: {

    id: string;

    brand: string;

    model: string;

    referenceNumber: string;

    serialFingerprint: string;

    askingPrice: { toString(): string };

    condition: string;

    listingPhotos: string[];

    status: WatchStatus;

  }) {

    return {

      id: w.id,

      brand: w.brand,

      model: w.model,

      referenceNumber: w.referenceNumber,

      serialFingerprint: w.serialFingerprint,

      askingPrice: w.askingPrice.toString(),

      condition: w.condition,

      listingPhotos: w.listingPhotos,

      status: w.status,

    };

  }

}


