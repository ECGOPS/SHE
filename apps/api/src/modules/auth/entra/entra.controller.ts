import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Permission, ROLE_PERMISSIONS, type AuthTokens, type AuthUser } from '@ecg-she/shared';
import * as crypto from 'node:crypto';
import { AuthCodeQueryDto, EntraExchangeDto } from '../../../common/dto/request.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { Audit } from '../../../common/decorators/audit.decorator';
import { RequirePermissions } from '../../../common/decorators/roles.decorator';
import { EntraService } from './entra.service';
import { EntraUserSyncService } from './entra-user-sync.service';
import { UsersService } from '../../users/users.service';
import { loadEntraConfig } from './entra.config';
import {
  clearRefreshCookie,
  refreshCookiePath,
  setRefreshCookie,
} from '../refresh-cookie';
import { cookieFlagsFromEnv } from '../cookie-flags';
import { SessionService } from '../session.service';

interface IdTokenClaims {
  oid: string;
  preferred_username?: string;
  email?: string;
  upn?: string;
  name?: string;
  groups?: string[];
}

/**
 * Microsoft Entra ID endpoints.
 *
 *  • GET  /auth/entra/login    → returns the auth-code URL the SPA navigates to
 *  • GET  /auth/entra/callback → exchanges the code, mints local JWTs
 *  • POST /auth/entra/exchange → SPA-friendly version (PKCE)
 *  • POST /auth/entra/sync     → Admin trigger for the user-provisioning job
 */
@ApiTags('auth')
@Controller('auth/entra')
export class EntraController {
  constructor(
    private readonly entra: EntraService,
    private readonly users: UsersService,
    private readonly sync: EntraUserSyncService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('config')
  publicConfig() {
    const cfg = this.entra.config();
    return {
      enabled: this.entra.isEnabled(),
      tenantId: cfg.tenantId,
      clientId: cfg.clientId,
      authority: cfg.authority,
      scopes: cfg.loginScopes,
      redirectUri: cfg.redirectUri,
    };
  }

  @Public()
  @Get('login')
  @Audit('AUTH_ENTRA_LOGIN_INIT')
  async login(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const url = await this.entra.buildAuthCodeUrl(state);
    res.redirect(url);
  }

  @Public()
  @Get('callback')
  @Audit('AUTH_ENTRA_CALLBACK')
  async callback(@Query() query: AuthCodeQueryDto, @Req() req: Request, @Res() res: Response) {
    const result = await this.entra.exchangeAuthCode(query.code);
    const tokens = await this.mintLocalSession(result.idTokenClaims as unknown as IdTokenClaims, req);
    this.rememberRefreshToken(res, tokens.tokens.refreshToken);
    res.redirect(this.entra.config().postLogoutRedirectUri);
  }

  @Public()
  @Post('exchange')
  @Audit('AUTH_ENTRA_EXCHANGE')
  async exchange(
    @Body() body: EntraExchangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ tokens: AuthTokens; user: AuthUser }> {
    const result = await this.entra.exchangeAuthCode(body.code, body.codeVerifier);
    const session = await this.mintLocalSession(result.idTokenClaims as unknown as IdTokenClaims, req);
    this.rememberRefreshToken(res, session.tokens.refreshToken);
    return { ...session, tokens: { ...session.tokens, refreshToken: '' } };
  }

  @ApiBearerAuth()
  @Post('sync')
  @RequirePermissions(Permission.USER_MANAGE)
  @Audit('AUTH_ENTRA_SYNC')
  triggerSync() {
    return this.sync.runOnce();
  }

  /**
   * Issue local JWT access + refresh tokens for an Entra-validated identity,
   * after upserting the local mirror record.
   */
  private async mintLocalSession(
    claims: IdTokenClaims,
    req: Request,
  ): Promise<{ tokens: AuthTokens; user: AuthUser }> {
    const cfg = loadEntraConfig(this.config);
    const email =
      claims.preferred_username ?? claims.upn ?? claims.email ?? `${claims.oid}@ecg.com.gh`;
    const user = await this.users.upsertFromEntra({
      entraObjectId: claims.oid,
      email,
      fullName: claims.name ?? email,
      groups: claims.groups ?? [],
      groupRoleMap: cfg.groupToRoleMap,
    });

    const opened = await this.sessions.open(user, {
      ip: req.ip ?? '',
      userAgent: req.header('user-agent') ?? '',
    });

    return {
      tokens: opened.tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        regionId: user.regionId,
        districtId: user.districtId,
        permissions: user.permissions?.length ? user.permissions : ROLE_PERMISSIONS[user.role],
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  private rememberRefreshToken(res: Response, refreshToken: string): void {
    if (!refreshToken) {
      clearRefreshCookie(res, this.cookieFlags());
      return;
    }
    const prefix = this.config.get<string>('API_PREFIX', 'api/v1');
    setRefreshCookie(res, refreshToken, {
      ...this.cookieFlags(),
      path: refreshCookiePath(prefix),
      maxAgeMs: this.sessions.absoluteMs(),
    });
  }

  private cookieFlags(): { secure: boolean; path: string; sameSite: 'lax' | 'none' } {
    return cookieFlagsFromEnv(
      this.config,
      refreshCookiePath(this.config.get<string>('API_PREFIX', 'api/v1')),
    );
  }
}
