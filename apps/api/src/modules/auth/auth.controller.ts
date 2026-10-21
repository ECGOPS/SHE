import { Body, Controller, Delete, Get, Param, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import type { AuthTokens, AuthUser } from '@ecg-she/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { AllowDuringMfaSetup } from '../../common/decorators/allow-mfa-setup.decorator';
import { AuthService, LoginResult } from './auth.service';
import { ChangePasswordDto, LoginDto, ReauthDto, RefreshDto, VerifyMfaDto } from './dto/login.dto';
import {
  clearRefreshCookie,
  readRefreshCookie,
  refreshCookiePath,
  setRefreshCookie,
  type RefreshCookieOptions,
} from './refresh-cookie';
import { clearCsrfCookie, newCsrfToken, setCsrfCookie } from './csrf';
import { cookieFlagsFromEnv } from './cookie-flags';
import { ABSOLUTE_MS_DEFAULT, durationMs } from './session-policy';
import { SessionService } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('ready')
  ready(): { ok: true } {
    return { ok: true };
  }

  @Public()
  @Get('csrf')
  csrf(@Res({ passthrough: true }) res: Response): { token: string } {
    return { token: this.issueCsrf(res) };
  }

  @Public()
  @Post('login')
  @Audit('AUTH_LOGIN')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    const result = await this.auth.login(dto.email, dto.password, dto.mfaCode, this.meta(req));
    this.issueCsrf(res);
    return { ...result, tokens: this.publishRefreshToken(res, result.tokens) };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    const token = readRefreshCookie(req) ?? dto.refreshToken;
    if (!token) {
      clearRefreshCookie(res, this.cookieOptions());
      throw new UnauthorizedException('Missing refresh token');
    }
    try {
      const tokens = await this.auth.refresh(token);
      this.issueCsrf(res);
      return this.publishRefreshToken(res, tokens);
    } catch (err) {
      clearRefreshCookie(res, this.cookieOptions());
      throw err;
    }
  }

  @ApiBearerAuth()
  @AllowDuringMfaSetup()
  @Post('logout')
  @Audit('AUTH_LOGOUT')
  logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    clearRefreshCookie(res, this.cookieOptions());
    clearCsrfCookie(res, this.csrfOptions());
    return this.auth.logout(user.id, user.sessionId);
  }

  @ApiBearerAuth()
  @Get('sessions')
  listSessions(@CurrentUser() user: AuthUser) {
    return this.sessions.list(user.id, user.sessionId);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @Audit('AUTH_SESSION_REVOKE')
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ revoked: true }> {
    await this.sessions.revoke(id, user.id);
    return { revoked: true };
  }

  @ApiBearerAuth()
  @Post('reauth')
  @Audit('AUTH_REAUTH')
  async reauth(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReauthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    const tokens = await this.auth.reauth(user.id, dto.password, user.sessionId, readRefreshCookie(req), this.meta(req));
    this.issueCsrf(res);
    return this.publishRefreshToken(res, tokens);
  }

  @ApiBearerAuth()
  @Post('password')
  @Audit('AUTH_PASSWORD_CHANGE')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    const tokens = await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      user.sessionId,
      readRefreshCookie(req),
      this.meta(req),
    );
    this.issueCsrf(res);
    return this.publishRefreshToken(res, tokens);
  }

  @ApiBearerAuth()
  @AllowDuringMfaSetup()
  @Post('mfa/setup')
  @Audit('AUTH_MFA_SETUP')
  setupMfa(@CurrentUser('id') userId: string) {
    return this.auth.setupMfa(userId);
  }

  @ApiBearerAuth()
  @AllowDuringMfaSetup()
  @Post('mfa/verify')
  @Audit('AUTH_MFA_VERIFY')
  async verifyMfa(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyMfaDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    const tokens = await this.auth.verifyMfa(userId, dto.code, this.meta(req));
    this.issueCsrf(res);
    return this.publishRefreshToken(res, tokens);
  }

  @ApiBearerAuth()
  @Get('session')
  session(@CurrentUser() user: AuthUser) {
    return user;
  }

  /** Store the refresh token in an HttpOnly cookie and keep it out of the JSON body. */
  private publishRefreshToken(res: Response, tokens: AuthTokens): AuthTokens {
    if (tokens.refreshToken) {
      const opts = this.cookieOptions();
      setRefreshCookie(res, tokens.refreshToken, {
        ...opts,
        maxAgeMs: this.absoluteMs(),
      });
    }
    return { ...tokens, refreshToken: '' };
  }

  private issueCsrf(res: Response): string {
    const token = newCsrfToken();
    const opts = this.csrfOptions();
    setCsrfCookie(res, token, { ...opts, maxAgeMs: this.absoluteMs() });
    return token;
  }

  private meta(req: Request): { ip: string; userAgent: string } {
    return { ip: req.ip ?? '', userAgent: req.header('user-agent') ?? '' };
  }

  private absoluteMs(): number {
    return durationMs(this.config.get<string>('SESSION_ABSOLUTE'), ABSOLUTE_MS_DEFAULT);
  }

  private csrfOptions(): { secure: boolean; path: string; sameSite: 'lax' | 'none' } {
    const prefix = this.config.get<string>('API_PREFIX', 'api/v1').replace(/^\/+|\/+$/g, '');
    return cookieFlagsFromEnv(this.config, `/${prefix}`);
  }

  private cookieOptions(): Pick<RefreshCookieOptions, 'secure' | 'path' | 'sameSite'> {
    return cookieFlagsFromEnv(this.config, refreshCookiePath(this.config.get<string>('API_PREFIX', 'api/v1')));
  }
}
