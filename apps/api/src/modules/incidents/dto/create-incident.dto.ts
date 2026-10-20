import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  ArrayMaxSize,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { IncidentSeverity, IncidentType } from '@ecg-she/shared';
import { IsUpload } from '../../../common/validation/uploads';

export class WitnessInputDto {
  @ApiProperty() @IsString() @MaxLength(4000) fullName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) contact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) role?: string;
  @ApiProperty() @IsString() @MaxLength(4000) statement!: string;
}

export class IncidentPhotoInputDto {
  @ApiProperty() @IsString() @MaxLength(120) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(80) mimeType!: string;
  @ApiProperty() @IsString() @MaxLength(7_500_000) @IsUpload('image') dataUrl!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) sizeBytes?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) capturedLat?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) capturedLng?: number;
}

export class CreateIncidentDto {
  @ApiProperty({ enum: IncidentType }) @IsEnum(IncidentType) type!: IncidentType;
  @ApiProperty({ enum: IncidentSeverity }) @IsEnum(IncidentSeverity) severity!: IncidentSeverity;
  @ApiProperty() @IsString() @MaxLength(4000) title!: string;
  @ApiProperty() @IsString() @MaxLength(4000) description!: string;
  @ApiProperty() @IsDateString() occurredAt!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) locationName?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) affectedPersons?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) injuredPersons?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) fatalities?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) estimatedCost?: number;

  @ApiPropertyOptional({ type: [WitnessInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WitnessInputDto)
  witnesses?: WitnessInputDto[];

  @ApiPropertyOptional({
    type: [IncidentPhotoInputDto],
    description: 'Photo evidence captured from camera/upload as data URLs. Local mode stores files under data/uploads/incidents.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'A maximum of 5 photos can be attached to one incident report' })
  @ValidateNested({ each: true })
  @Type(() => IncidentPhotoInputDto)
  photos?: IncidentPhotoInputDto[];

  @ApiPropertyOptional({ description: 'Client-generated UUID for offline-first deduplication' })
  @IsOptional()
  @IsString() @MaxLength(4000)
  offlineClientId?: string;

  @ApiPropertyOptional({ description: 'Near miss this incident replaces. Photos are copied and the near miss is closed as converted.' })
  @IsOptional()
  @IsUUID()
  sourceNearMissId?: string;
}

export class SyncIncidentsDto {
  @ApiProperty({ type: [CreateIncidentDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateIncidentDto)
  items!: CreateIncidentDto[];
}

export class FindingInputDto {
  @ApiProperty({ enum: ['IMMEDIATE', 'UNDERLYING', 'ROOT', 'CONTRIBUTING'] })
  @IsIn(['IMMEDIATE', 'UNDERLYING', 'ROOT', 'CONTRIBUTING'])
  category!: 'IMMEDIATE' | 'UNDERLYING' | 'ROOT' | 'CONTRIBUTING';

  @ApiProperty() @IsString() @MaxLength(4000) description!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) recommendation?: string;
}
