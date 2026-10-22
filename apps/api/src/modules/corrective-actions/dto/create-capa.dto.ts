import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min,
  MaxLength,
} from 'class-validator';
import { PROTOCOL_LINK_KIND, ROOT_CAUSE_METHOD, RootCauseMethod } from '@ecg-she/shared';

const SOURCE_TYPES = [
  'INCIDENT',
  'HAZARD',
  'NEAR_MISS',
  'INSPECTION',
  'AUDIT_FINDING',
  'ENVIRONMENTAL_EVENT',
  'CUSTOMER_COMPLAINT',
  'INTERNAL_REVIEW',
] as const;

export class CreateCapaDto {
  @ApiProperty() @IsString() @MaxLength(4000) title!: string;
  @ApiProperty() @IsString() @MaxLength(4000) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(SOURCE_TYPES) sourceType?: (typeof SOURCE_TYPES)[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiProperty() @IsDateString() dueDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) priority?:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) slaDays?: number;

  // ── ISO 9001 §10.2 / ISO 45001 §10.2 alignment ──────────────────────
  @ApiPropertyOptional({ enum: ROOT_CAUSE_METHOD })
  @IsOptional()
  @IsString() @MaxLength(4000)
  rootCauseMethod?: RootCauseMethod;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) rootCauseStatement?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() effectivenessReviewDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['CORRECTION', 'CORRECTIVE_ACTION', 'PREVENTIVE_ACTION'])
  actionType?: 'CORRECTION' | 'CORRECTIVE_ACTION' | 'PREVENTIVE_ACTION';

  @ApiPropertyOptional() @IsOptional() @IsBoolean() protocolUpdateRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) protocolUpdateNotes?: string;
  @ApiPropertyOptional({ enum: PROTOCOL_LINK_KIND }) @IsOptional() @IsIn(PROTOCOL_LINK_KIND) protocolLinkKind?: (typeof PROTOCOL_LINK_KIND)[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() protocolLinkId?: string;
}

export class UpdateCapaProgressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) evidenceNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['IN_PROGRESS', 'VERIFICATION']) status?: 'IN_PROGRESS' | 'VERIFICATION';
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(ROOT_CAUSE_METHOD) rootCauseMethod?: RootCauseMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) rootCauseStatement?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() protocolUpdateRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) protocolUpdateNotes?: string;
  @ApiPropertyOptional({ enum: PROTOCOL_LINK_KIND }) @IsOptional() @IsIn(PROTOCOL_LINK_KIND) protocolLinkKind?: (typeof PROTOCOL_LINK_KIND)[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() protocolLinkId?: string;
}

export class VerifyCapaDto {
  @ApiProperty() @IsIn(['EFFECTIVE', 'PARTIAL', 'INEFFECTIVE']) effectivenessOutcome!: 'EFFECTIVE' | 'PARTIAL' | 'INEFFECTIVE';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
