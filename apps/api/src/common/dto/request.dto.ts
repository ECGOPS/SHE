import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { EscalationEntityType, HEALTH_DUTY } from '@ecg-she/shared';

@ValidatorConstraint({ name: 'dateNotBefore', async: false })
class DateNotBeforeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const from = (args.object as { from?: string }).from;
    if (!from || typeof value !== 'string') return true;
    return new Date(value).getTime() >= new Date(from).getTime();
  }

  defaultMessage(): string {
    return 'to must be on or after from';
  }
}

export class DateRangeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  @Validate(DateNotBeforeConstraint)
  to?: string;
}

export class DashboardKpiQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  hoursWorked?: number;
}

export class DashboardTrendsQueryDto {
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  days = 30;
}

export class UserListQueryDto {
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
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class RegionFilterQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  regionId?: string;
}

export class CompetenceQueryDto {
  @ApiProperty({ enum: HEALTH_DUTY })
  @IsIn(HEALTH_DUTY)
  duty!: (typeof HEALTH_DUTY)[number];
}

export class HolderKitQueryDto {
  @ApiProperty({ enum: ['FALL_PROTECTION', 'INSULATING'] })
  @IsIn(['FALL_PROTECTION', 'INSULATING'])
  category!: 'FALL_PROTECTION' | 'INSULATING';
}

export class EscalationHistoryQueryDto {
  @ApiProperty({ enum: EscalationEntityType })
  @IsIn(Object.values(EscalationEntityType))
  entityType!: EscalationEntityType;

  @ApiProperty()
  @IsUUID()
  entityId!: string;
}

export class AuthCodeQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;
}

export class EntraExchangeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9\-._~]{43,128}$/)
  codeVerifier?: string;
}

export class CloseNotesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noFurtherAction?: boolean;
}

export class AssignInvestigatorDto {
  @ApiProperty()
  @IsUUID()
  investigatorId!: string;
}
