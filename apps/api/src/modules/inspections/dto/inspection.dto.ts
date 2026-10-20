import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsUpload } from '../../../common/validation/uploads';
import { InspectionType, NFPA_70E_PPE_CATEGORY, WEATHER_CONDITION } from '@ecg-she/shared';

export class InspectionItemDto {
  @ApiProperty() @IsString() @MaxLength(4000) question!: string;
  @ApiProperty() @IsIn(['PASS', 'FAIL', 'NA']) answer!: 'PASS' | 'FAIL' | 'NA';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) immediateAction?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() capaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hazardId?: string;
}

export class CreateInspectionDto {
  @ApiProperty({ enum: InspectionType }) @IsEnum(InspectionType) type!: InspectionType;
  @ApiProperty() @IsString() @MaxLength(4000) assetOrLocation!: string;
  @ApiProperty() @IsDateString() inspectedAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional({ enum: WEATHER_CONDITION }) @IsOptional() @IsIn(WEATHER_CONDITION) weatherCondition?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) temperatureC?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) arcFlashBoundaryM?: number;
  @ApiPropertyOptional({ enum: NFPA_70E_PPE_CATEGORY })
  @IsOptional()
  @IsIn(NFPA_70E_PPE_CATEGORY)
  nfpaPpeCategory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) observations?: string;
  @ApiProperty({ type: [InspectionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectionItemDto)
  items!: InspectionItemDto[];

  @ApiPropertyOptional({ type: () => [InspectionPhotoDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => InspectionPhotoDto)
  photos?: InspectionPhotoDto[];
}

export class InspectionPhotoDto {
  @ApiProperty() @IsString() @MaxLength(120) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(80) mimeType!: string;
  @ApiProperty() @IsString() @MaxLength(7_500_000) @IsUpload('image') dataUrl!: string;
}

export class UpdateInspectionItemsDto {
  @ApiProperty({ type: [InspectionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectionItemDto)
  items!: InspectionItemDto[];
}
