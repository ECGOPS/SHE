import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { COMPLIANCE_RESULT, MANAGEMENT_RECORD_KIND, MANAGEMENT_STANDARD } from '@ecg-she/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ManagementQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MANAGEMENT_RECORD_KIND })
  @IsOptional()
  @IsIn(MANAGEMENT_RECORD_KIND)
  kind?: string;
}

export class CreateManagementRecordDto {
  @ApiProperty({ enum: MANAGEMENT_RECORD_KIND })
  @IsIn(MANAGEMENT_RECORD_KIND)
  kind!: string;

  @ApiProperty({ enum: MANAGEMENT_STANDARD })
  @IsIn(MANAGEMENT_STANDARD)
  standard!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clauseRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueOn?: string;

  @ApiPropertyOptional({ enum: COMPLIANCE_RESULT })
  @IsOptional()
  @IsIn(COMPLIANCE_RESULT)
  complianceResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  significant?: boolean;
}

export class UpdateManagementRecordDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'CLOSED'] })
  @IsOptional()
  @IsIn(['OPEN', 'CLOSED'])
  status?: 'OPEN' | 'CLOSED';

  @ApiPropertyOptional({ enum: COMPLIANCE_RESULT })
  @IsOptional()
  @IsIn(COMPLIANCE_RESULT)
  complianceResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description?: string;
}
