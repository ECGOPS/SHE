import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @ApiPropertyOptional({ description: '6-digit TOTP code if MFA is enabled' })
  @IsOptional()
  @Matches(/^\d{6}$/)
  mfaCode?: string;
}

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Ignored when the HttpOnly refresh cookie is present' })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  refreshToken?: string;
}

export class VerifyMfaDto {
  @ApiProperty() @Matches(/^\d{6}$/) code!: string;
}

export class ReauthDto {
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) currentPassword!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
