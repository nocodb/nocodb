import axios from 'axios';
import { google } from 'googleapis';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import { APP_LABEL } from './constant';
import type { RateLimitOptions, TokenData } from '@noco-integrations/core';
import type { GoogleCalendarAuthConfig } from './types';
import type { TestConnectionResponse } from '@noco-integrations/core';
import type { calendar_v3 } from 'googleapis';

export class GoogleCalendarAuthIntegration extends AuthIntegration<
  GoogleCalendarAuthConfig,
  calendar_v3.Calendar
> {
  public client: calendar_v3.Calendar | null = null;

  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 250,
        perMilliseconds: 1000,
      },
      maxQueueSize: 100,
    };
  }

  public async authenticate(): Promise<calendar_v3.Calendar> {
    let accessToken: string;
    switch (this.config.type) {
      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error(`Missing required ${APP_LABEL} OAuth token`);
        }
        accessToken = this.config.oauth_token;
        break;

      default:
        throw new Error('Not implemented');
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: this.config.refresh_token,
    });

    const self = this;
    // handle refresh token
    oauth2Client.on('tokens', (token) => {
      const callbackPayload: TokenData & { expires_in: number } = {
        oauth_token: token.access_token!,
        refresh_token: token.refresh_token!,
        expires_in: token.expiry_date!,
      };
      self.tokenRefreshCallback?.(callbackPayload);
      Object.assign(self._config, token);
    });

    this.client = google.calendar({ version: 'v3', auth: oauth2Client });

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      return await this.use(async (client) => {
        await client.calendarList.list();
        return {
          success: true,
        };
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async exchangeToken(payload: {
    code: string;
    code_verifier?: string;
  }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const { code, code_verifier } = payload;

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri!);
    params.append('client_id', clientId!);
    params.append('client_secret', clientSecret!);

    if (code_verifier) {
      params.append('code_verifier', code_verifier);
    }

    const response = await axios.post(tokenUri, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    return {
      oauth_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  }

  /**
   * Refresh access token using refresh token
   * @see https://developers.google.com/identity/protocols/oauth2/web-server#offline
   */
  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    return payload as any;
  }
}
