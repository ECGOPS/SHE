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
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsUpload } from '../../../common/validation/uploads';
import {
  ENVIRONMENTAL_ASPECT,
  ENVIRONMENTAL_IMPACT,
  EnvironmentalEventType,
  RISK_SEVERITY,
} from '@ecg-she/shared';

export const ENV_SUBSTANCES = ['TRANSFORMER_OIL', 'DIESEL', 'PETROL', 'HYDRAULIC_OIL', 'SF6', 'WASTE_OIL', 'OTHER'] as const;
const MATERIAL_RELEASE = ['OIL_SPILL', 'WASTE_DISPOSAL', 'POLLUTION'] as const;

export class EnvironmentalPhotoDto {
  @ApiProperty() @IsString() @MaxLength(120) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(80) mimeType!: string;
  @ApiProperty() @IsString() @MaxLength(7_500_000) @IsUpload('image') dataUrl!: string;
}

export class CreateEnvironmentalEventDto {
  @ApiProperty({ enum: EnvironmentalEventType }) @IsEnum(EnvironmentalEventType) type!: EnvironmentalEventType;
  @ApiProperty() @IsString() @MaxLength(4000) title!: string;
  @ApiProperty() @IsString() @MaxLength(4000) description!: string;
  @ApiProperty() @IsDateString() occurredAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) @Min(0) @Max(1_000_000_000) estimatedQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) quantityUnit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) locationName?: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) containmentActions?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(ENV_SUBSTANCES) substance?: (typeof ENV_SUBSTANCES)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) substanceDetail?: string;
  @ApiPropertyOptional({ type: () => [EnvironmentalPhotoDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => EnvironmentalPhotoDto)
  photos?: EnvironmentalPhotoDto[];
}

export class AddEnvironmentalPhotosDto {
  @ApiProperty({ type: () => [EnvironmentalPhotoDto] })
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => EnvironmentalPhotoDto)
  photos!: EnvironmentalPhotoDto[];
}

export class WasteConsignmentDto {
  @ApiProperty() @IsString() @MaxLength(4000) wasteContractor!: string;
  @ApiProperty() @IsString() @MaxLength(4000) disposalSite!: string;
  @ApiProperty() @IsString() @MaxLength(4000) waybillNumber!: string;
}

export { MATERIAL_RELEASE };

export class ContainEnvironmentalEventDto {
  @ApiProperty() @IsString() @MaxLength(4000) containmentActions!: string;
}

export class AssessEnvironmentalEventDto {
  @ApiProperty() @IsIn(ENVIRONMENTAL_ASPECT) aspect!: string;
  @ApiProperty() @IsIn(ENVIRONMENTAL_IMPACT) impact!: string;
  @ApiProperty() @IsIn(RISK_SEVERITY) severity!: string;
  @ApiProperty() @IsBoolean() regulatoryReportable!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() agencyNotifiedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) agencyNotificationRef?: string;
}

export class CloseEnvironmentalEventDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() noFurtherAction?: boolean;
}
