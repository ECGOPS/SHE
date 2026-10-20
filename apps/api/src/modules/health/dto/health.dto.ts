import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min,
  MaxLength,
} from 'class-validator';
import {
  EXPOSURE_AGENT,
  FITNESS_OUTCOME,
  HEALTH_DUTY,
  HEALTH_RECORD_TYPE,
  SURVEILLANCE_TEST,
  VACCINE,
  VACCINE_DOSE,
} from '@ecg-she/shared';

export class CreateHealthRecordDto {
  @ApiProperty({ enum: HEALTH_RECORD_TYPE }) @IsIn(HEALTH_RECORD_TYPE) recordType!: (typeof HEALTH_RECORD_TYPE)[number];
  @ApiProperty() @IsDateString() recordDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() employeeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() nextReviewDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(FITNESS_OUTCOME) fitnessOutcome?: (typeof FITNESS_OUTCOME)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) restrictions?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(HEALTH_DUTY) duty?: (typeof HEALTH_DUTY)[number];
  @ApiPropertyOptional() @IsOptional() @IsIn(SURVEILLANCE_TEST) surveillanceTest?: (typeof SURVEILLANCE_TEST)[number];
  @ApiPropertyOptional() @IsOptional() @IsIn(EXPOSURE_AGENT) exposureAgent?: (typeof EXPOSURE_AGENT)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) exposureReading?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) locationName?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(VACCINE) vaccine?: (typeof VACCINE)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) vaccineDetail?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(VACCINE_DOSE) dose?: (typeof VACCINE_DOSE)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) batchNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) campaignTitle?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) attendeeCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) clinician?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) clinicalNotes?: string;
}
