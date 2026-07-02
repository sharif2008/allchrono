import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateWatchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  brand?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  model?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  referenceNumber?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  askingPrice?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  condition?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  listingPhotos?: string[];

  /** Toggle marketplace visibility (LISTED ↔ UNLISTED). */
  @IsOptional()
  @IsBoolean()
  listed?: boolean;
}
