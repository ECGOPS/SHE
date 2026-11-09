import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CONTROL_HIERARCHY,
  RISK_ASSESSMENT_CONTROL_STATUS,
  RISK_ASSESSMENT_HAZARD_IDS,
  RISK_ASSESSMENT_PERSONS_AT_RISK,
  RISK_LIKELIHOOD,
  RISK_SEVERITY,
} from '@ecg-she/shared';

export class RiskAssessmentControlRowDto {
  @ApiProperty() @IsString() @MaxLength(4000) identifiedHazard!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(RISK_SEVERITY) consequence?: (typeof RISK_SEVERITY)[number];
  @ApiPropertyOptional() @IsOptional() @IsIn(RISK_LIKELIHOOD) likelihood?: (typeof RISK_LIKELIHOOD)[number];
  @ApiPropertyOptional() @IsOptional() @IsIn(CONTROL_HIERARCHY) controlHierarchy?: (typeof CONTROL_HIERARCHY)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) requiredControls?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() implemented?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsIn(RISK_LIKELIHOOD) residualLikelihood?: (typeof RISK_LIKELIHOOD)[number];
  @ApiPropertyOptional() @IsOptional() @IsIn(RISK_SEVERITY) residualSeverity?: (typeof RISK_SEVERITY)[number];
}

export class CreateRiskAssessmentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(256) locationWorkplace!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(512) activityBeingDone!: string;
  @ApiProperty() @IsDateString() assessmentDate!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(512) assessorNames!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(512) othersConsulted?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsIn(RISK_ASSESSMENT_HAZARD_IDS as unknown as string[], { each: true })
  selectedHazards?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) specificCircumstance?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(RISK_ASSESSMENT_PERSONS_AT_RISK as unknown as string[], { each: true })
  personsAtRisk?: string[];
  @ApiPropertyOptional({ type: [RiskAssessmentControlRowDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RiskAssessmentControlRowDto)
  controls?: RiskAssessmentControlRowDto[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(RISK_ASSESSMENT_CONTROL_STATUS)
  controlConclusion?: (typeof RISK_ASSESSMENT_CONTROL_STATUS)[number];
  @ApiPropertyOptional() @IsOptional() @IsUUID() offlineClientId?: string;
}

export class UpdateRiskAssessmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(256) locationWorkplace?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(512) activityBeingDone?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() assessmentDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(512) assessorNames?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(512) othersConsulted?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsIn(RISK_ASSESSMENT_HAZARD_IDS as unknown as string[], { each: true })
  selectedHazards?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) specificCircumstance?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(RISK_ASSESSMENT_PERSONS_AT_RISK as unknown as string[], { each: true })
  personsAtRisk?: string[];
  @ApiPropertyOptional({ type: [RiskAssessmentControlRowDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RiskAssessmentControlRowDto)
  controls?: RiskAssessmentControlRowDto[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(RISK_ASSESSMENT_CONTROL_STATUS)
  controlConclusion?: (typeof RISK_ASSESSMENT_CONTROL_STATUS)[number] | null;
}

export class RejectRiskAssessmentDto {
  @ApiProperty() @IsString() @MaxLength(4000) notes!: string;
}
