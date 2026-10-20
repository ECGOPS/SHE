import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

function blankToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  page = 1;

  @ApiPropertyOptional({ default: 25, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 25;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ description: 'Column name from the register allow-list. Anything else is ignored by the query.' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9]{0,31}$/)
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC';

  /** One status, or several separated by commas. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(160)
  @Matches(/^[A-Z][A-Z0-9_]{0,40}(,[A-Z][A-Z0-9_]{0,40}){0,11}$/)
  status?: string;
}
