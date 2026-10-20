import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IncidentSeverity, IncidentType } from '@ecg-she/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class IncidentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: IncidentType }) @IsOptional() @IsEnum(IncidentType) type?: IncidentType;
  @ApiPropertyOptional({ enum: IncidentSeverity }) @IsOptional() @IsEnum(IncidentSeverity) severity?: IncidentSeverity;
  @ApiPropertyOptional() @IsOptional() @IsUUID() regionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() districtId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() investigatorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
