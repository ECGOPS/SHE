import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ConsentDto {
  @ApiProperty() @IsBoolean() accepted!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() optionalContact?: boolean;
}

export class CorrectProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(160) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) phone?: string;
}
