import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  CONTROL_HIERARCHY,
  ControlHierarchy,
  RISK_LIKELIHOOD,
  RISK_SEVERITY,
  RiskLikelihood,
  RiskSeverity,
} from '@ecg-she/shared';

export class ReviewHazardDto {
  @ApiPropertyOptional({ enum: RISK_LIKELIHOOD }) @IsOptional() @IsIn(RISK_LIKELIHOOD) likelihood?: RiskLikelihood;
  @ApiPropertyOptional({ enum: RISK_SEVERITY }) @IsOptional() @IsIn(RISK_SEVERITY) severity?: RiskSeverity;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) existingControls?: string;
  @ApiPropertyOptional({ enum: CONTROL_HIERARCHY }) @IsOptional() @IsIn(CONTROL_HIERARCHY) controlHierarchy?: ControlHierarchy;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) controlMeasures?: string;
  @ApiPropertyOptional({ enum: RISK_LIKELIHOOD }) @IsOptional() @IsIn(RISK_LIKELIHOOD) residualLikelihood?: RiskLikelihood;
  @ApiPropertyOptional({ enum: RISK_SEVERITY }) @IsOptional() @IsIn(RISK_SEVERITY) residualSeverity?: RiskSeverity;
  @ApiPropertyOptional() @IsOptional() @IsDateString() targetCompletionDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() mitigationOwnerId?: string;
}
