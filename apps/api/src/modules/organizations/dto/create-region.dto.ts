import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateRegionDto {
  @ApiProperty() @IsString() @MaxLength(32) code!: string;
  @ApiProperty() @IsString() @MaxLength(128) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(256) headquartersAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateDistrictDto {
  @ApiProperty() @IsUUID() regionId!: string;
  @ApiProperty() @IsString() @MaxLength(32) code!: string;
  @ApiProperty() @IsString() @MaxLength(128) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateRegionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(256) headquartersAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateDistrictDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class PruneOrphansDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true }) @MaxLength(200, { each: true })
  @MaxLength(16, { each: true })
  @Matches(/^[A-Z0-9-]{2,16}$/, { each: true })
  codes!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
