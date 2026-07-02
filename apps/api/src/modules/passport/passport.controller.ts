import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PassportService } from './passport.service';

@Controller('passport')
export class PassportController {
  constructor(private readonly passportService: PassportService) {}

  // Public buyer trust signal — no auth required.
  @Public()
  @Get('by-serial/:serial')
  getBySerial(@Param('serial') serial: string) {
    return this.passportService.getBySerial(serial);
  }
}
