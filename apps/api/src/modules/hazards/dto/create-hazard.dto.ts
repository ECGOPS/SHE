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
  ValidateNested,
} from 'class-validator';
import { IsUpload } from '../../../common/validation/uploads';
import {
  CONTROL_HIERARCHY,
  ControlHierarchy,
  HazardCategory,
  RISK_LIKELIHOOD,
  RISK_SEVERITY,
  RiskLikelihood,
  RiskSeverity,
} from '@ecg-she/shared';

export class CreateHazardDto {
  @ApiProperty() @IsString() @MaxLength(4000) title!: string;
  @ApiProperty() @IsString() @MaxLength(4000) description!: string;
  @ApiProperty({ enum: HazardCategory }) @IsEnum(HazardCategory) category!: HazardCategory;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() peopleExposed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) immediateAction?: string;

  @ApiPropertyOptional({ enum: RISK_LIKELIHOOD }) @IsOptional() @IsIn(RISK_LIKELIHOOD) likelihood?: RiskLikelihood;
  @ApiPropertyOptional({ enum: RISK_SEVERITY }) @IsOptional() @IsIn(RISK_SEVERITY) severity?: RiskSeverity;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) controlMeasures?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) locationName?: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() offlineClientId?: string;

  // ── ISO 31000 / ISO 45001 §6.1.2 ────────────────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) existingControls?: string;

  @ApiPropertyOptional({ enum: CONTROL_HIERARCHY })
  @IsOptional()
  @IsIn(CONTROL_HIERARCHY)
  controlHierarchy?: ControlHierarchy;

  @ApiPropertyOptional({ enum: RISK_LIKELIHOOD })
  @IsOptional()
  @IsIn(RISK_LIKELIHOOD)
  residualLikelihood?: RiskLikelihood;

  @ApiPropertyOptional({ enum: RISK_SEVERITY })
  @IsOptional()
  @IsIn(RISK_SEVERITY)
  residualSeverity?: RiskSeverity;

  @ApiPropertyOptional() @IsOptional() @IsDateString() targetCompletionDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() mitigationOwnerId?: string;

  @ApiPropertyOptional({ type: () => [HazardPhotoDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => HazardPhotoDto)
  photos?: HazardPhotoDto[];
}

export class HazardPhotoDto {
  @ApiProperty() @IsString() @MaxLength(120) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(80) mimeType!: string;
  @ApiProperty() @IsString() @MaxLength(7_500_000) @IsUpload('image') dataUrl!: string;
}
