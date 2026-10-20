import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RISK_LIKELIHOOD, RISK_SEVERITY } from '@ecg-she/shared';

export class JsaStepDto {
  @ApiProperty() @IsString() @MaxLength(4000) step!: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(200, { each: true }) hazards!: string[];
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(200, { each: true }) controls!: string[];
  @ApiPropertyOptional() @IsOptional() @IsIn(RISK_LIKELIHOOD) likelihood?: (typeof RISK_LIKELIHOOD)[number];
  @ApiPropertyOptional() @IsOptional() @IsIn(RISK_SEVERITY) severity?: (typeof RISK_SEVERITY)[number];
}

export class JsaCrewDto {
  @ApiProperty() @IsString() @MaxLength(4000) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() acknowledgedAt?: string;
}

export class CreateJsaDto {
  @ApiProperty() @IsString() @MaxLength(4000) workActivity!: string;
  @ApiProperty() @IsString() @MaxLength(4000) jobLocation!: string;
  @ApiProperty() @IsDateString() jobDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(500) crewSize?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supervisorId?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) ppeRequired?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) toolsAndEquipment?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() permitRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() permitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) emergencyProcedures?: string;
  @ApiProperty({ type: [JsaStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JsaStepDto)
  steps!: JsaStepDto[];
  @ApiPropertyOptional({ type: [JsaCrewDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JsaCrewDto)
  crew?: JsaCrewDto[];
  @ApiPropertyOptional() @IsOptional() @IsUUID() offlineClientId?: string;
}

export class RejectJsaDto {
  @ApiProperty() @IsString() @MaxLength(4000) notes!: string;
}

export class UpdateJsaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) workActivity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) jobLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() jobDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(500) crewSize?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supervisorId?: string | null;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) ppeRequired?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) toolsAndEquipment?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() permitRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() permitId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) emergencyProcedures?: string;
  @ApiPropertyOptional({ type: [JsaStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JsaStepDto)
  steps?: JsaStepDto[];
  @ApiPropertyOptional({ type: [JsaCrewDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JsaCrewDto)
  crew?: JsaCrewDto[];
}
