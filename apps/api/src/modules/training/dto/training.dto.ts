import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ArrayMaxSize,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsUpload } from '../../../common/validation/uploads';
import { HEALTH_DUTY, ISO_45001_CLAUSES } from '@ecg-she/shared';

const CATEGORIES = ['SAFETY', 'CERTIFICATION', 'COMPETENCY', 'INDUCTION', 'REFRESHER'] as const;

export class CreateCourseDto {
  @ApiProperty() @IsString() @MaxLength(4000) code!: string;
  @ApiProperty() @IsString() @MaxLength(4000) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiProperty() @IsIn(CATEGORIES) category!: (typeof CATEGORIES)[number];
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(400) durationHours!: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) validForMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) accreditationBody?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) competencyReference?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(ISO_45001_CLAUSES) iso45001Clause?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) trainerQualification?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(HEALTH_DUTY) authorizesDuty?: (typeof HEALTH_DUTY)[number];
}

export class CertificateDto {
  @ApiProperty() @IsString() @MaxLength(120) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(80) mimeType!: string;
  @ApiProperty() @IsString() @MaxLength(7_500_000) @IsUpload('document') dataUrl!: string;
}

export class ClassAttendeeDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty() @IsIn(['PASS', 'FAIL']) result!: 'PASS' | 'FAIL';
  @ApiPropertyOptional({ type: () => CertificateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CertificateDto)
  certificate?: CertificateDto;
}

export class RecordClassDto {
  @ApiProperty() @IsUUID() courseId!: string;
  @ApiProperty() @IsDateString() heldOn!: string;
  @ApiProperty() @IsString() @MaxLength(4000) locationName!: string;
  @ApiProperty() @IsString() @MaxLength(4000) trainerName!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiProperty({ type: () => [ClassAttendeeDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ClassAttendeeDto)
  attendees!: ClassAttendeeDto[];
}
