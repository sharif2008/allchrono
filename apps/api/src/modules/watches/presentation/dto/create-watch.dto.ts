import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateWatchDto {
  @IsString()
  @MinLength(2)
  brand!: string;

  @IsString()
  @MinLength(1)
  model!: string;

  @IsString()
  @MinLength(1)
  referenceNumber!: string;

  @IsString()
  @MinLength(3)
  serialFingerprint!: string;

  @IsNumber()
  @IsPositive()
  askingPrice!: number;

  @IsString()
  @MinLength(2)
  condition!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  listingPhotos?: string[];

  @IsOptional()
  @IsBoolean()
  listed?: boolean;
}
