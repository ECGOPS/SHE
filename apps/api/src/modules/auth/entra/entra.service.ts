import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import { loadEntraConfig, EntraConfig } from './entra.config';

/**
 * Server-side MSAL Confidential Client.
 *
 * Used for:
 *   • Authorisation Code flow exchange (web / SPA login)
 *   • App-only access tokens for Microsoft Graph (user provisioning sync)
 *   • On-Behalf-Of (OBO) when calling Graph for the signed-in user
 */
@Injectable()
export class EntraService {
  private readonly logger = new Logger(EntraService.name);
  private readonly cfg: EntraConfig;
  private readonly app?: ConfidentialClientApplication;

  constructor(config: ConfigService) {
    this.cfg = loadEntraConfig(config);
    if (!this.cfg.enabled) {
      this.logger.warn('Microsoft Entra ID is not configured — SSO disabled');
      return;
    }
    const msalConfig: Configuration = {
      auth: {
        clientId: this.cfg.clientId,
        authority: this.cfg.authority,
        clientSecret: this.cfg.clientSecret,
      },
      system: {
        loggerOptions: {
          loggerCallback: (_level, message) => this.logger.debug(message),
          piiLoggingEnabled: false,
          logLevel: 3,
        },
      },
    };
    this.app = new ConfidentialClientApplication(msalConfig);
  }

  isEnabled(): boolean {
    return !!this.app;
  }

  config(): EntraConfig {
    return this.cfg;
  }

  /**
   * Build the URL the browser must visit to start the auth-code flow.
   */
  async buildAuthCodeUrl(state: string, codeChallenge?: string): Promise<string> {
    this.assertEnabled();
    return this.app!.getAuthCodeUrl({
      scopes: this.cfg.loginScopes,
      redirectUri: this.cfg.redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod: codeChallenge ? 'S256' : undefined,
      prompt: 'select_account',
    });
  }

  /**
   * Exchange the authorisation code returned by Entra ID for an access token
   * + id token. Used by the `/auth/entra/callback` endpoint.
   */
  async exchangeAuthCode(code: string, codeVerifier?: string) {
    this.assertEnabled();
    const result = await this.app!.acquireTokenByCode({
      code,
      scopes: this.cfg.loginScopes,
      redirectUri: this.cfg.redirectUri,
      codeVerifier,
    });
    if (!result?.accessToken || !result.idToken) {
      throw new UnauthorizedException('Entra ID did not return tokens');
    }
    return result;
  }

  /**
   * Acquire an app-only Graph token using the client credentials flow.
   * Used by the scheduled user-sync job.
   */
  async acquireGraphToken(): Promise<string> {
    this.assertEnabled();
    const result = await this.app!.acquireTokenByClientCredential({
      scopes: this.cfg.graphScopes,
      skipCache: false,
    });
    if (!result?.accessToken) throw new UnauthorizedException('Could not acquire Graph token');
    return result.accessToken;
  }

  private assertEnabled(): void {
    if (!this.app) throw new UnauthorizedException('Microsoft Entra ID is not configured');
  }
}
