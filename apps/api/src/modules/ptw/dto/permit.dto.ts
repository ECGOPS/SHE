import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ISOLATION_METHOD, PermitType } from '@ecg-she/shared';

export class CreatePermitDto {
  @ApiProperty({ enum: PermitType }) @IsEnum(PermitType) type!: PermitType;
  @ApiProperty() @IsString() @MaxLength(4000) workDescription!: string;
  @ApiProperty() @IsString() @MaxLength(4000) workLocation!: string;
  @ApiProperty() @IsDateString() validFrom!: string;
  @ApiProperty() @IsDateString() validTo!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Type(() => Number) crewSize?: number;
  @ApiPropertyOptional({ enum: ISOLATION_METHOD }) @IsOptional() @IsIn(ISOLATION_METHOD) isolationMethod?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) isolationReference?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) isolationPoints?: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) hazardsIdentified!: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) controlMeasures!: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) ppeRequired?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() gasTestRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() holderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() standbyPersonId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() authorisingManagerId?: string;
}

export class PermitNoteDto {
  @ApiProperty() @IsString() @MaxLength(4000) notes!: string;
}

export class GasTestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) oxygen?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) lel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) toxic?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
