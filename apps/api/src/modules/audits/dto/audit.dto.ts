import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { AuditType } from '@ecg-she/shared';

export const AUDIT_METHODS = ['INTERVIEW', 'DOCUMENT_REVIEW', 'FIELD_VERIFICATION'] as const;
export const AUDIT_RESULTS = ['CONFORM', 'NONCONFORM', 'NA'] as const;
export const FINDING_SEVERITY = ['OBSERVATION', 'MINOR_NC', 'MAJOR_NC', 'CRITICAL'] as const;

export class CreateAuditDto {
  @ApiProperty({ enum: AuditType }) @IsEnum(AuditType) type!: AuditType;
  @ApiProperty() @IsString() @MaxLength(4000) scope!: string;
  @ApiProperty() @IsString() @MaxLength(4000) objectives!: string;
  @ApiProperty() @IsString() @MaxLength(4000) auditee!: string;
  @ApiProperty() @IsDateString() scheduledDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true }) @MaxLength(200, { each: true })
  criteria!: string[];
  @ApiProperty({ type: [String], enum: AUDIT_METHODS })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(AUDIT_METHODS, { each: true })
  methods!: string[];
  @ApiPropertyOptional() @IsOptional() @IsUUID() leadAuditorId?: string;
  @ApiProperty() @IsString() @MaxLength(4000) leadAuditorName!: string;
}

export class AuditCheckItemDto {
  @ApiProperty() @IsString() @MaxLength(4000) clause!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(AUDIT_RESULTS) result?: 'CONFORM' | 'NONCONFORM' | 'NA';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) evidence?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(FINDING_SEVERITY) severity?: 'OBSERVATION' | 'MINOR_NC' | 'MAJOR_NC' | 'CRITICAL';
  @ApiPropertyOptional() @IsOptional() @IsUUID() findingId?: string;
}

export class UpdateChecklistDto {
  @ApiProperty({ type: [AuditCheckItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditCheckItemDto)
  checklist!: AuditCheckItemDto[];
}

export class AuditNoteDto {
  @ApiProperty() @IsString() @MaxLength(4000) notes!: string;
}

export class LinkFindingActionDto {
  @ApiProperty() @IsUUID() capaId!: string;
}
