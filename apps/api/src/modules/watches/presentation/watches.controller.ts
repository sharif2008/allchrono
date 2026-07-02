import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role, WatchStatus } from '@prisma/client';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../../../common/decorators/current-user.decorator';
import { WatchesService } from '../application/watches.service';
import { CreateWatchDto } from './dto/create-watch.dto';
import { UpdateWatchDto } from './dto/update-watch.dto';

@Controller('watches')
export class WatchesController {
  constructor(private readonly watchesService: WatchesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SELLER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWatchDto) {
    return this.watchesService.createListing(user.id, dto);
  }

  @Public()
  @Get()
  list(
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '12',
  ) {
    return this.watchesService.listCatalogue({
      status: status ? (status as WatchStatus) : undefined,
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(50, Math.max(1, parseInt(pageSize, 10) || 12)),
    });
  }

  // Seller's own inventory (must be declared before :id to avoid shadowing).
  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(Role.SELLER)
  mine(@CurrentUser() user: AuthUser) {
    return this.watchesService.listForSeller(user.id);
  }

  @Post(':id/list')
  @UseGuards(RolesGuard)
  @Roles(Role.SELLER)
  listOnMarketplace(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.watchesService.listOnMarketplace(user.id, id);
  }

  @Post(':id/unlist')
  @UseGuards(RolesGuard)
  @Roles(Role.SELLER)
  unlistFromMarketplace(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.watchesService.unlistFromMarketplace(user.id, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SELLER)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateWatchDto,
  ) {
    return this.watchesService.updateListing(user.id, id, dto);
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.watchesService.getPublicDetail(id);
  }
}
