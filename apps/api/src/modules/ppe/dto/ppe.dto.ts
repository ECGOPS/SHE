import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min,
  MaxLength,
} from 'class-validator';
import { NFPA_70E_PPE_CATEGORY, PPE_ANSI_STANDARDS, PPE_EN_STANDARDS } from '@ecg-she/shared';

const CATEGORIES = ['HEAD', 'EYE', 'EAR', 'HAND', 'FOOT', 'BODY', 'FALL_PROTECTION', 'RESPIRATORY', 'INSULATING'] as const;
const VOLTAGE = ['CLASS_00', 'CLASS_0', 'CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4'] as const;
const REASONS = ['NEW_HIRE', 'REPLACEMENT', 'ROUTINE_REFRESH', 'DAMAGED_REPLACEMENT'] as const;

export class CreatePpeItemDto {
  @ApiProperty() @IsString() @MaxLength(4000) sku!: string;
  @ApiProperty() @IsString() @MaxLength(4000) name!: string;
  @ApiProperty() @IsIn(CATEGORIES) category!: (typeof CATEGORIES)[number];
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) stockOnHand!: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) reorderLevel?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) shelfLifeMonths?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) retestIntervalMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) manufacturer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) modelNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(PPE_EN_STANDARDS) enStandard?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(PPE_ANSI_STANDARDS) ansiStandard?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(NFPA_70E_PPE_CATEGORY) nfpaArcCategory?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(VOLTAGE) voltageClass?: (typeof VOLTAGE)[number];
}

export class IssuePpeDto {
  @ApiProperty() @IsUUID() ppeItemId!: string;
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty() @IsDateString() issuedOn!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @ApiProperty() @IsIn(['PASS']) inspectionResult!: 'PASS';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) serialNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) batchNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(REASONS) issueReason?: (typeof REASONS)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) inspectionNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
}

export class WithdrawPpeDto {
  @ApiProperty() @IsIn(['RETURNED', 'DAMAGED', 'LOST']) status!: 'RETURNED' | 'DAMAGED' | 'LOST';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) inspectionNotes?: string;
}
