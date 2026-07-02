import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Verdict } from '@prisma/client';

export class CreateTradeDto {
  @IsUUID()
  watchId!: string;
}

export class AuthenticationVerdictDto {
  @IsEnum(Verdict)
  verdict!: Verdict;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoHashes?: string[];
}

// Body is intentionally minimal; its canonical hash drives idempotency.
export class FundEscrowDto {
  @IsOptional()
  amount?: number;
}

export class MarkShippedDto {
  @IsString()
  @MinLength(3)
  trackingNumber!: string;
}

export class DisputeDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
