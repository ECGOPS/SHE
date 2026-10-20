import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { EscalationEntityType, IssueScope } from '@ecg-she/shared';

export class EscalateBodyDto {
  @ApiProperty({ enum: EscalationEntityType })
  @IsIn(Object.values(EscalationEntityType))
  entityType!: EscalationEntityType;

  @ApiProperty()
  @IsUUID()
  entityId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional({ enum: IssueScope })
  @IsOptional()
  @IsIn(Object.values(IssueScope))
  toScope?: IssueScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toUserId?: string;
}

export class ResolveBodyDto {
  @ApiProperty({ enum: EscalationEntityType })
  @IsIn(Object.values(EscalationEntityType))
  entityType!: EscalationEntityType;

  @ApiProperty()
  @IsUUID()
  entityId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  notes!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noFurtherAction?: boolean;
}

export class ReopenBodyDto {
  @ApiProperty({ enum: EscalationEntityType })
  @IsIn(Object.values(EscalationEntityType))
  entityType!: EscalationEntityType;

  @ApiProperty()
  @IsUUID()
  entityId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}
