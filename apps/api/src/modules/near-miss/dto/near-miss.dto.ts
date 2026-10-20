import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { NearMissCategory, SEVERITY_POTENTIAL } from '@ecg-she/shared';
import { IsUpload } from '../../../common/validation/uploads';

export class NearMissPhotoDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(80) mimeType!: string;
  @ApiProperty() @IsString() @MaxLength(7_500_000) @IsUpload('image') dataUrl!: string;
}

export class CreateNearMissDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) description!: string;
  @ApiProperty({ enum: NearMissCategory }) @IsEnum(NearMissCategory) category!: NearMissCategory;
  @ApiProperty() @IsDateString() occurredAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() anonymous?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) locationName?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(SEVERITY_POTENTIAL) severityPotential?: (typeof SEVERITY_POTENTIAL)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) bodyPartAtRisk?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) potentialInjuryNature?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() offlineClientId?: string;
  @ApiPropertyOptional({ type: [NearMissPhotoDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => NearMissPhotoDto)
  photos?: NearMissPhotoDto[];
}

export class ReviewNearMissDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) immediateCause?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) rootCause?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) witnessStatement?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(SEVERITY_POTENTIAL) severityPotential?: (typeof SEVERITY_POTENTIAL)[number];
}
